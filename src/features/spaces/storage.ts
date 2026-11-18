import { createClient } from "@/lib/supabase/client";
import { IMMUTABLE_CACHE_CONTROL } from "@/lib/storageCache";

// Client-side storage helpers for the spaces feature. Content uploads stay
// browser → Supabase directly: PDF (10 MB), image (5 MB) and preview-image
// (1.5 MB) caps all exceed the default Server-Action body limit, so routing
// them through the SSR server is not an option (mirrors the profile feature's
// storage.ts). The relational row-writes that follow go through the feature's
// Server Actions.
//
// This module lives OUTSIDE `components/` so it does not trip the
// `no-restricted-imports` guardrail that bans `@/lib/supabase/*` there.

/** Returns the current authenticated user id, or null. Used by the builder hook
 * to prefix per-user storage paths before the row-write action runs. */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length).split("?")[0];
}

// ─── HTML editor (GrapeJS save) ──────────────────────────

/** Extract the `space-html` storage path from a public html_url. */
export function htmlStoragePath(publicUrl: string): string {
  const marker = "/space-html/";
  const clean = publicUrl.split("?")[0];
  const idx = clean.indexOf(marker);
  if (idx === -1) throw new Error("Unexpected html_url format");
  return clean.slice(idx + marker.length);
}

/** Overwrites the space's HTML blob in place (upsert). */
export async function uploadSpaceHtml(
  storagePath: string,
  html: string
): Promise<void> {
  const supabase = createClient();
  const blob = new Blob([html], { type: "text/html" });
  const { error } = await supabase.storage
    .from("space-html")
    .upload(storagePath, blob, { contentType: "text/html", upsert: true });
  if (error) throw error;
}

/** Uploads a regenerated preview screenshot and returns its cache-busted
 * public URL (the path is reused on every save, so the `?t=` query defeats the
 * browser, CDN and image-optimizer caches). */
export async function uploadSpacePreviewScreenshot(
  userId: string,
  spaceId: string,
  blob: Blob
): Promise<string> {
  const supabase = createClient();
  const previewPath = `${userId}/${spaceId}-preview.png`;
  const { error } = await supabase.storage
    .from("space-previews")
    .upload(previewPath, blob, { contentType: "image/png", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage
    .from("space-previews")
    .getPublicUrl(previewPath);
  return `${data.publicUrl}?t=${Date.now()}`;
}

// ─── Content builder uploads ────────────────────────────────────────────────

/** Removes an old preview image (by its public URL) so storage doesn't leak. */
export async function removeSpacePreviewByUrl(publicUrl: string): Promise<void> {
  const path = extractStoragePath(publicUrl, "space-previews");
  if (!path) return;
  const supabase = createClient();
  await supabase.storage.from("space-previews").remove([path]);
}

/** Uploads a user-picked preview image and returns its public URL. */
export async function uploadSpacePreviewImage(
  userId: string,
  file: File
): Promise<string> {
  const supabase = createClient();
  const fileExt = file.name.split(".").pop();
  const filePath = `${userId}/${Date.now()}.${fileExt}`;
  const { error } = await supabase.storage
    .from("space-previews")
    .upload(filePath, file, { cacheControl: IMMUTABLE_CACHE_CONTROL });
  if (error) throw error;
  const { data } = supabase.storage
    .from("space-previews")
    .getPublicUrl(filePath);
  return data.publicUrl;
}

/** Uploads a PDF file and returns its public URL. */
export async function uploadSpacePdf(
  userId: string,
  file: File
): Promise<string> {
  const supabase = createClient();
  const filePath = `${userId}/${Date.now()}.pdf`;
  const { error } = await supabase.storage
    .from("space-pdfs")
    .upload(filePath, file, { contentType: "application/pdf", upsert: false, cacheControl: IMMUTABLE_CACHE_CONTROL });
  if (error) throw error;
  const { data } = supabase.storage.from("space-pdfs").getPublicUrl(filePath);
  return data.publicUrl;
}

/** Uploads a content image and returns its public URL. */
export async function uploadSpaceImage(
  userId: string,
  file: File
): Promise<string> {
  const supabase = createClient();
  const fileExt = file.name.split(".").pop();
  // Random suffix: batch uploads run in parallel and can share a millisecond.
  const filePath = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${fileExt}`;
  const { error } = await supabase.storage
    .from("space-images")
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: IMMUTABLE_CACHE_CONTROL,
    });
  if (error) throw error;
  const { data } = supabase.storage.from("space-images").getPublicUrl(filePath);
  return data.publicUrl;
}
