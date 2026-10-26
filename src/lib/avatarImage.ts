import { getImageProps } from "next/image";

// Supabase Storage public objects are allowed by next.config's remotePatterns;
// anything else (Google profile photos, blob: previews mid-upload) passes
// through untouched. Avatars are upserted at a stable path, but every update
// stores a new `?t=` URL, so the optimizer's cache never serves a stale one.
const OPTIMIZABLE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//;

/**
 * `src`/`srcSet` for an avatar drawn at `size` CSS px, resized by the Next
 * image optimizer when possible (the originals are often full-size uploads).
 */
export function avatarImageProps(
  src: string | null | undefined,
  size: number,
): { src?: string; srcSet?: string } {
  if (!src) return {};
  if (!OPTIMIZABLE.test(src)) return { src };
  const { props } = getImageProps({ src, alt: "", width: size, height: size });
  return { src: props.src, srcSet: props.srcSet };
}
