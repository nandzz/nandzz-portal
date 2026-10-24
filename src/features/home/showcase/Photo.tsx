import type { CSSProperties } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";

// Every picture in the showcase goes through this map: a path under /public, or
// `null` for a tinted placeholder.
const showcase = (id: string) => `/home/showcase/${id}.webp`;

export const PHOTOS = {
  "velora-avatar": showcase("velora-logo"),
  "velora-gallery-1": showcase("velora-gallery-1"),
  "velora-gallery-2": showcase("velora-gallery-2"),
  "velora-gallery-3": showcase("velora-gallery-3"),
  "velora-gallery-4": showcase("velora-gallery-4"),
  "velora-gallery-5": showcase("velora-gallery-5"),
  "velora-gallery-6": "/home/gallery-1.webp", // blow-dry, shared with the features section
  "barber-avatar": null,
  "barber-gallery-1": showcase("barber-gallery-1"),
  "barber-gallery-2": showcase("barber-gallery-2"),
  "barber-gallery-3": "/home/gallery-2.webp", // barber at work, shared with the features section
  "ink-avatar": showcase("ink-logo"),
  "ink-publication-1": showcase("ink-publication-1"),
  "ink-publication-2": showcase("ink-publication-2"),
  "physio-avatar": showcase("physio-logo"),
  "physio-staff-1": showcase("physio-staff-1"),
  "physio-staff-2": showcase("physio-staff-2"),
  "bloom-avatar": null,
  "bloom-gallery-1": showcase("bloom-gallery-1"),
  "bloom-gallery-2": showcase("bloom-gallery-2"),
  "bloom-gallery-3": showcase("bloom-gallery-3"),
  "yoga-avatar": null,
  "rosa-avatar": showcase("rosa-avatar"),
  "rosa-gallery-1": showcase("rosa-gallery-1"),
  "rosa-gallery-2": showcase("rosa-gallery-2"),
  "rosa-gallery-3": showcase("rosa-gallery-3"),
} satisfies Record<string, string | null>;

export type PhotoId = keyof typeof PHOTOS;

// `sizes` for the features section's /home/gallery-* photos. Showcase tiles that
// reuse one of those files pass the same value, so it is fetched once.
export const GALLERY_SIZES = "(min-width: 1024px) 180px, 30vw";

export function Photo({
  id,
  hue = 290,
  sizes = "96px",
  eager,
  className = "",
  style,
}: {
  id: PhotoId;
  hue?: number; // placeholder tint, so neighbouring placeholders read as different pictures
  sizes?: string;
  eager?: boolean; // above the fold at load: don't lazy-load
  className?: string;
  style?: CSSProperties;
}) {
  const src: string | null = PHOTOS[id];
  return (
    <span className={`relative block overflow-hidden ${className}`} style={style}>
      {src ? (
        <Image src={src} alt="" fill sizes={sizes} loading={eager ? "eager" : undefined} className="object-cover" />
      ) : (
        <span
          className="showcase-placeholder absolute inset-0 flex items-center justify-center"
          style={{ "--h": hue } as CSSProperties}
        >
          <ImageIcon className="h-1/3 max-h-5 w-1/3 max-w-5 opacity-35" strokeWidth={1.6} />
        </span>
      )}
    </span>
  );
}
