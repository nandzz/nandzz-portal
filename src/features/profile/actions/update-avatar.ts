"use server";

import { createClient } from "@/lib/supabase/server";
import { updateAvatarSchema } from "../schemas";
import { isOwnStorageUrl, revalidatePublicProfile } from "../revalidate";

export type UpdateAvatarResult =
  | { ok: true }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "INVALID_INPUT" | "FAILED";
      message?: string;
    };

// Persists the avatar public URL after the client has uploaded the image to the
// `avatars` bucket (upload stays browser-side — see features/profile/storage).
export async function updateAvatar(input: {
  avatarUrl: string;
}): Promise<UpdateAvatarResult> {
  const parsed = updateAvatarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };
  if (!isOwnStorageUrl(parsed.data.avatarUrl, "avatars", user.id)) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: parsed.data.avatarUrl })
    .eq("id", user.id)
    .select("username")
    .single();
  if (error) return { ok: false, error: "FAILED", message: error.message };

  revalidatePublicProfile(data?.username);
  return { ok: true };
}
