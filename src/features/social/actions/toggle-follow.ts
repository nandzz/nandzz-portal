"use server";

import { createClient } from "@/lib/supabase/server";
import { toggleFollowSchema } from "../schemas";
import { revalidatePublicProfile } from "@/features/profile/revalidate";

export type ToggleFollowResult =
  | { ok: true; isFollowing: boolean }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "INVALID_INPUT" | "SELF_FOLLOW" | "FAILED";
      message?: string;
    };

export async function toggleFollow(input: {
  profileId: string;
  follow?: boolean;
}): Promise<ToggleFollowResult> {
  const parsed = toggleFollowSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const { profileId, follow } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  // DB enforces `follower_id != following_id`; reject early with a clear code.
  if (user.id === profileId) return { ok: false, error: "SELF_FOLLOW" };

  let shouldFollow = follow;
  if (shouldFollow === undefined) {
    const { data: existing } = await supabase
      .from("user_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", profileId)
      .maybeSingle();
    shouldFollow = !existing;
  }

  if (shouldFollow) {
    // Upsert on the unique pair: following twice is a no-op, not an error.
    const { error } = await supabase
      .from("user_follows")
      .upsert(
        { follower_id: user.id, following_id: profileId },
        { onConflict: "follower_id,following_id", ignoreDuplicates: true }
      );
    if (error) return { ok: false, error: "FAILED", message: error.message };
  } else {
    const { error } = await supabase
      .from("user_follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", profileId);
    if (error) return { ok: false, error: "FAILED", message: error.message };
  }

  // Follower/following counts live on both profile rows: drop both cached
  // public profiles so the counts are right immediately (the action response
  // also re-renders the page the button is on — no router.refresh needed).
  const { data: rows } = await supabase
    .from("profiles")
    .select("username")
    .in("id", [user.id, profileId]);
  for (const row of rows ?? []) revalidatePublicProfile(row.username);

  return { ok: true, isFollowing: shouldFollow };
}
