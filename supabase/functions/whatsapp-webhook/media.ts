import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";
import type { MediaAction } from "./types.ts";

const MAX_IMAGE_DIMENSION = 4096;
const JPEG_QUALITY = 82;

export const FIELD_TO_BUCKET: Record<string, string> = {
  image_url: "space-images",
  pdf_url:   "space-pdfs",
  html_url:  "space-html",
};

export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "text/html": "html",
  "text/markdown": "md",
  "text/x-markdown": "md",
  "text/plain": "txt",
};

export function classifyMime(mimeType: string): MediaAction | null {
  const mime = mimeType.split(";")[0].trim().toLowerCase();

  if (["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"].includes(mime))
    return { kind: "storage", field: "image_url" };

  if (mime === "application/pdf")
    return { kind: "storage", field: "pdf_url" };

  if (mime === "text/html")
    return { kind: "storage", field: "html_url" };

  if (["text/markdown", "text/x-markdown", "text/plain"].includes(mime))
    return { kind: "text", field: "markdown_content" };

  console.log("[media] unsupported mime type:", mime);
  return null;
}

export function mimeToExt(mimeType: string): string {
  const mime = mimeType.split(";")[0].trim().toLowerCase();
  return MIME_TO_EXT[mime] ?? mime.split("/")[1] ?? "bin";
}

function maybeResize(image: Image): Image {
  if (image.width <= MAX_IMAGE_DIMENSION && image.height <= MAX_IMAGE_DIMENSION) return image;
  const scale = Math.min(MAX_IMAGE_DIMENSION / image.width, MAX_IMAGE_DIMENSION / image.height);
  return image.resize(Math.round(image.width * scale), Math.round(image.height * scale)) as Image;
}

export async function normalizeImage(
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<{ data: Uint8Array; contentType: string; ext: string }> {
  const mime = mimeType.split(";")[0].trim().toLowerCase();
  let image: Image;

  if (mime === "image/heic" || mime === "image/heif") {
    // Dynamic import so the bundler skips it at build time; loaded on first HEIC message only
    const heicMod = await import("https://esm.sh/@jsquash/heic@1.1.0");
    const decodeHeic = heicMod.default ?? heicMod;
    const imageData = await decodeHeic(new Uint8Array(buffer));
    image = new Image(imageData.width, imageData.height);
    image.bitmap.set(imageData.data);
  } else {
    image = await Image.decode(new Uint8Array(buffer)) as Image;
  }

  const jpeg = await maybeResize(image).encodeJPEG(JPEG_QUALITY);
  return { data: jpeg, contentType: "image/jpeg", ext: "jpg" };
}
