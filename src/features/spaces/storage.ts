import { createClient } from "@/lib/supabase/client";

// Client-side storage helpers for the spaces feature. Content uploads stay
// browser → Supabase directly: PDF (10 MB), image (5 MB) and preview-image
// (1.5 MB) caps all exceed the default Server-Action body limit, so routing
// them through the SSR server is not an option (mirrors the profile feature's
// storage.ts). The relational row-writes that follow go through the feature's
// Server Actions.
//
// This module lives OUTSIDE `components/` so it does not trip the
// `no-restricted-imports` guardrail that bans `@/lib/supabase/*` there.

/** Escape user-controlled text before interpolating it into HTML markup. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The minimal placeholder page uploaded for a brand-new "AI Generated" space.
 * Content is filled in later via the AI Edit assistant (HtmlSpaceEditor).
 * Pure template — no network calls. The title is user-controlled and this HTML
 * is served from a public bucket, so it must be HTML-escaped to prevent stored
 * XSS.
 */
function buildAiStubHtml(title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; background: #09090b; color: #ffffff; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  p { opacity: 0.35; font-size: 14px; letter-spacing: 0.01em; }
</style>
</head>
<body><p>Use the AI assistant to generate content ✦</p></body>
</html>`;
}

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

// ─── AI stub HTML ──────────────────────────────────────────────────────────

/**
 * Uploads the AI stub HTML to the `space-html` bucket and returns its public
 * URL. Throws on upload failure — callers surface `error.message` to the user.
 */
export async function uploadAiStubHtml(
  userId: string,
  title: string
): Promise<string> {
  const supabase = createClient();
  const stub = buildAiStubHtml(title);
  const stubBlob = new Blob([stub], { type: "text/html" });
  const filePath = `${userId}/${Date.now()}.html`;
  const { error: uploadError } = await supabase.storage
    .from("space-html")
    .upload(filePath, stubBlob, { contentType: "text/html", upsert: false });
  if (uploadError) {
    throw new Error("Failed to create content: " + uploadError.message);
  }
  const { data } = supabase.storage.from("space-html").getPublicUrl(filePath);
  return data.publicUrl;
}

// ─── HTML editor (GrapeJS save + AI-edit approval) ──────────────────────────

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

/** Uploads a regenerated preview screenshot and returns its public URL. */
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
  return data.publicUrl;
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
    .upload(filePath, file);
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
    .upload(filePath, file, { contentType: "application/pdf", upsert: false });
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
  const filePath = `${userId}/${Date.now()}.${fileExt}`;
  const { error } = await supabase.storage
    .from("space-images")
    .upload(filePath, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("space-images").getPublicUrl(filePath);
  return data.publicUrl;
}
