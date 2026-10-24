import type { CSSProperties } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";

// Every picture in the showcase goes through this map. `null` renders a tinted
// placeholder; drop a file in /public/home/showcase/ and set its path to swap it in.
export const PHOTOS = {
  "velora-avatar": null,
  "velora-gallery-1": "/home/gallery-1.webp",
  "velora-gallery-2": "/home/gallery-2.webp",
  "velora-gallery-3": "/home/gallery-3.webp",
  "velora-gallery-4": "/home/gallery-4.webp",
  "velora-gallery-5": "/home/gallery-5.webp",
  "velora-gallery-6": "/home/gallery-6.webp",
  "barber-avatar": null,
  "barber-gallery-1": null,
  "barber-gallery-2": null,
  "barber-gallery-3": null,
  "barber-gallery-4": null,
  "barber-gallery-5": null,
  "barber-gallery-6": null,
  "ink-avatar": null,
  "ink-publication-1": null,
  "ink-publication-2": null,
  "physio-avatar": null,
  "physio-staff-1": null,
  "physio-staff-2": null,
  "bloom-avatar": null,
  "bloom-gallery-1": null,
  "bloom-gallery-2": null,
  "bloom-gallery-3": null,
  "yoga-avatar": null,
  "rosa-avatar": null,
  "rosa-gallery-1": null,
  "rosa-gallery-2": null,
  "rosa-gallery-3": null,
  "rosa-gallery-4": null,
  "rosa-gallery-5": null,
  "rosa-gallery-6": null,
} satisfies Record<string, string | null>;

export type PhotoId = keyof typeof PHOTOS;

// `sizes` shared by every render of the /home/gallery-* photos (hero phone and
// the features section), so the browser picks one candidate and fetches it once.
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
