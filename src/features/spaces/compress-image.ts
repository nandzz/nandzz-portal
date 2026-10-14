// Client-side image downscale + re-encode before upload. Phone photos are
// typically 4–8 MB at 4000px+; profiles never show them above ~2560px, so we
// shrink them in the browser (faster upload, less storage/egress, and photos
// over the 5 MB bucket limit become uploadable instead of being rejected).

/** Longest edge after downscale. */
const MAX_DIMENSION = 2560;
const QUALITY = 0.85;
/** The `space-images` bucket rejects anything bigger (enforced server-side). */
export const MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024;
/** Raw files above this are refused before we even try to decode them. */
export const MAX_RAW_IMAGE_BYTES = 30 * 1024 * 1024;

/** Types the bucket accepts as-is (mirrors its `allowed_mime_types`). */
const UPLOADABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

function renamed(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "image";
  return `${base}.${ext}`;
}

/**
 * Returns an upload-ready version of `file`: downscaled to MAX_DIMENSION and
 * re-encoded as WebP (JPEG where the browser can't encode WebP). GIFs pass
 * through untouched so animation survives. If decoding fails (e.g. HEIC in
 * Chrome) or re-encoding doesn't help, the original is returned — callers must
 * still check `isUploadableImage` on the result.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.type === "image/gif") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);

    // Safari < 17 silently falls back to PNG for unsupported types — detect it.
    let blob = await canvasToBlob(canvas, "image/webp");
    if (!blob || blob.type !== "image/webp") {
      // JPEG has no alpha: paint white behind transparent PNGs.
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      blob = await canvasToBlob(canvas, "image/jpeg");
    }
    if (!blob) return file;

    // Already-small images can grow when re-encoded; keep whichever is smaller.
    if (blob.size >= file.size && scale === 1 && UPLOADABLE_TYPES.has(file.type)) return file;

    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], renamed(file.name, ext), { type: blob.type, lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}

/** True if the bucket will accept this file. */
export function isUploadableImage(file: File): boolean {
  return UPLOADABLE_TYPES.has(file.type) && file.size <= MAX_UPLOAD_IMAGE_BYTES;
}
