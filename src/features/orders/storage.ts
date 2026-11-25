import { createClient } from "@/lib/supabase/client";
import { IMMUTABLE_CACHE_CONTROL } from "@/lib/storageCache";

// Browser-side product photo uploads (bucket `product-images`, 5 MB, jpeg/png/
// webp, owner folder only). Every photo is decoded and RE-ENCODED here, never
// uploaded as-is: that shrinks phone photos and drops EXIF metadata such as
// the GPS position of a home kitchen. A file the browser can't decode (e.g.
// HEIC in Chrome) is refused instead of uploaded raw.
//
// Lives outside `components/` (the lint guardrail bans `@/lib/supabase/*`
// there); the row writes go through actions/products.ts.

export const PRODUCT_IMAGES_BUCKET = "product-images";
const MAX_EDGE = 1600;
const QUALITY = 0.85;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_RAW_BYTES = 30 * 1024 * 1024;

export type PreparedImage = { blob: Blob; ext: "webp" | "jpg"; width: number; height: number; previewUrl: string };
export type PrepareError = "too_big" | "unsupported";

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

export async function prepareProductImage(file: File): Promise<PreparedImage | PrepareError> {
  if (file.size > MAX_RAW_BYTES) return "too_big";
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return "unsupported";
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "unsupported";
    ctx.drawImage(bitmap, 0, 0, width, height);
    let blob = await toBlob(canvas, "image/webp");
    let ext: "webp" | "jpg" = "webp";
    if (!blob || blob.type !== "image/webp") {
      // Old Safari can't encode WebP: JPEG on white (no alpha).
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      blob = await toBlob(canvas, "image/jpeg");
      ext = "jpg";
    }
    if (!blob) return "unsupported";
    if (blob.size > MAX_BYTES) return "too_big";
    return { blob, ext, width, height, previewUrl: URL.createObjectURL(blob) };
  } finally {
    bitmap.close();
  }
}

/** Uploads to `${ownerId}/${productId}/<uuid>.<ext>`; returns the storage path. */
export async function uploadProductImage(ownerId: string, productId: string, img: PreparedImage): Promise<string | null> {
  const supabase = createClient();
  const path = `${ownerId}/${productId}/${crypto.randomUUID()}.${img.ext}`;
  const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, img.blob, {
    contentType: img.ext === "webp" ? "image/webp" : "image/jpeg",
    cacheControl: IMMUTABLE_CACHE_CONTROL,
    upsert: false,
  });
  return error ? null : path;
}

/** Best-effort cleanup of uploads whose row write failed. */
export async function removeUploadedImages(paths: string[]): Promise<void> {
  if (!paths.length) return;
  await createClient().storage.from(PRODUCT_IMAGES_BUCKET).remove(paths);
}
