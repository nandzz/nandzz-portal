"use server";

import { createClient } from "@/lib/supabase/server";
import { setFollowCountsVisibilitySchema } from "../schemas";
import { revalidatePublicProfile } from "../revalidate";

export type SetFollowCountsVisibilityResult =
  | { ok: true }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "INVALID_INPUT" | "FAILED";
      message?: string;
    };

// Toggles whether the followers / following counts show on the caller's public
// profile. Scoped to the caller's own row via `.eq("id", user.id)`.
export async function setFollowCountsVisibility(input: {
  value: boolean;
}): Promise<SetFollowCountsVisibilityResult> {
  const parsed = setFollowCountsVisibilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase
    .from("profiles")
    .update({ show_follow_counts: parsed.data.value })
    .eq("id", user.id)
    .select("username")
    .single();
  if (error) return { ok: false, error: "FAILED", message: error.message };

  revalidatePublicProfile(data?.username);
  return { ok: true };
}
