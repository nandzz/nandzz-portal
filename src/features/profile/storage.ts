import { createClient } from "@/lib/supabase/client";
import { IMMUTABLE_CACHE_CONTROL } from "@/lib/storageCache";

// Client-side storage helpers for the profile feature. Uploads intentionally
// stay browser → Supabase directly (unchanged from the previous implementation):
// the 1.5 MB image cap exceeds the default Server-Action body limit, and going
// direct avoids a double hop through the SSR server. The relational writes that
// follow each upload go through the feature's Server Actions.
//
// This module lives OUTSIDE `components/` so it does not trip the
// `no-restricted-imports` guardrail that bans `@/lib/supabase/*` there.

// Avatar bucket path is stable (`<id>/avatar.jpg`) and upserted; callers append
// a cache-busting query string to the returned public URL.
export async function uploadAvatar(
  profileId: string,
  blob: Blob
): Promise<string> {
  const supabase = createClient();
  const filePath = `${profileId}/avatar.jpg`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(filePath, blob, { upsert: true, contentType: "image/jpeg" });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
  return data.publicUrl;
}

// Deletes any existing background files so storage doesn't accumulate, then
// uploads the new one under a timestamped path (unique URL = no cache issues).
export async function uploadBackground(
  profileId: string,
  file: File
): Promise<string> {
  const supabase = createClient();
  await removeBackgroundFiles(profileId);

  const ext = file.name.split(".").pop() ?? "jpg";
  const filePath = `${profileId}/background-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("profile-backgrounds")
    .upload(filePath, file, { cacheControl: IMMUTABLE_CACHE_CONTROL });
  if (error) throw error;

  const { data } = supabase.storage
    .from("profile-backgrounds")
    .getPublicUrl(filePath);
  return data.publicUrl;
}

export async function removeBackgroundFiles(profileId: string): Promise<void> {
  const supabase = createClient();
  const { data: existing } = await supabase.storage
    .from("profile-backgrounds")
    .list(profileId);
  if (existing && existing.length > 0) {
    await supabase.storage
      .from("profile-backgrounds")
      .remove(existing.map((f) => `${profileId}/${f.name}`));
  }
}

// Brand logo shares the avatars bucket, stable path `<id>/logo.jpg`, upserted.
export async function uploadBrandLogo(
  userId: string,
  file: File
): Promise<string> {
  const supabase = createClient();
  const filePath = `${userId}/logo.jpg`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true, contentType: "image/jpeg" });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
  return data.publicUrl;
}
