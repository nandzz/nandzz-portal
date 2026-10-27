"use client";

import { createContext, useContext, useMemo, useRef, useState, useEffect, useCallback } from "react";
import { HoverPrefetchLink } from "@/components/HoverPrefetchLink";
import Image from "next/image";
import dynamic from "next/dynamic";
import type { Space, Profile } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfileStyle } from "@/contexts/ProfileStyleContext";
import { SectionOwnerMenu } from "./SectionOwnerMenu";
import { SeeMoreLink } from "./SeeMoreLink";
import { updateProfileLayout } from "@/features/profile/actions/update-profile-layout";
import { useSerialSave } from "@/lib/useSerialSave";
import {
  GALLERY_CAPTION_STYLES,
  GALLERY_LAYOUTS,
  type GalleryCaptionStyle,
  type GalleryLayout,
} from "@/lib/gallery/layouts";
import { spaceDisplayTitle } from "@/lib/spaces/display-title";

// Mounted only once "See more" opens it.
const GalleryModal = dynamic(() =>
  import("@/features/profile/components/GalleryModal").then((m) => m.GalleryModal),
);

interface ProfileGalleryProps {
  images: Space[];
  totalCount: number;
  profile: Profile;
  isOwner: boolean;
  initialLayout: GalleryLayout;
  initialCaptionStyle: GalleryCaptionStyle;
  /** When set, a "see all" link is shown once totalCount exceeds what's rendered. */
  seeMoreHref?: string;
  /** When true, "see more" opens a paginated modal instead of navigating to
   * `seeMoreHref`. Used by the profile preview so the full gallery stays in place. */
  enableModal?: boolean;
}

const imageSrc = (space: Space) => space.preview_image_url ?? space.image_url;

export function ProfileGallery({
  images,
  totalCount,
  profile,
  isOwner,
  initialLayout,
  initialCaptionStyle,
  seeMoreHref,
  enableModal,
}: ProfileGalleryProps) {
  const { t } = useLanguage();
  // Live text color (owner Style picker previews instantly); prop outside a profile page.
  const liveStyle = useProfileStyle()?.style;
  const textColor = liveStyle ? liveStyle.textColor : profile.text_color;
  // Optimistic + strictly ordered saves (rapid picks can't land out of order
  // or be snapped back by an older save's refresh). The action revalidates the
  // public profile itself — no client revalidate fetch / router.refresh.
  const [layout, handleLayoutChange] = useSerialSave<GalleryLayout>(initialLayout, async (value) => {
    const result = await updateProfileLayout({ gallery_layout: value });
    if (!result.ok) throw new Error(result.error);
  });
  const [captionStyle, handleCaptionStyleChange] = useSerialSave<GalleryCaptionStyle>(
    initialCaptionStyle,
    async (value) => {
      const result = await updateProfileLayout({ gallery_caption_style: value });
      if (!result.ok) throw new Error(result.error);
    },
  );
  const [modalOpen, setModalOpen] = useState(false);

  const withImage = useMemo(() => images.filter((s) => imageSrc(s)), [images]);

  if (withImage.length === 0) return null;

  const showSeeMore = totalCount > withImage.length;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-lg font-semibold"
          style={textColor ? { color: textColor } : undefined}
        >
          {t.profile.galleryTitle}
          <span
            className="ml-1.5 text-sm font-normal text-muted-foreground tabular-nums"
            style={textColor ? { color: textColor, opacity: 0.65 } : undefined}
          >
            {totalCount}
          </span>
        </h2>

        {isOwner && (
          <SectionOwnerMenu
            sectionId="gallery"
            sectionName={t.profile.galleryTitle}
            layouts={GALLERY_LAYOUTS}
            layout={layout}
            onLayoutChange={handleLayoutChange}
            captions={{
              styles: GALLERY_CAPTION_STYLES,
              value: captionStyle,
              onChange: handleCaptionStyleChange,
            }}
          />
        )}
      </div>

      <CaptionStyleContext.Provider value={captionStyle}>
        <GalleryLayoutView layout={layout} images={withImage} username={profile.username} />
      </CaptionStyleContext.Provider>

      {showSeeMore &&
        (enableModal ? (
          <SeeMoreLink label={t.profile.seeMore} onClick={() => setModalOpen(true)} />
        ) : seeMoreHref ? (
          <SeeMoreLink label={t.profile.seeMore} href={seeMoreHref} />
        ) : null)}

      {enableModal && modalOpen && (
        <GalleryModal
          onClose={() => setModalOpen(false)}
          profileId={profile.id}
          username={profile.username}
          totalCount={totalCount}
        />
      )}
    </div>
  );
}

// ── Layout renderers ─────────────────────────────────────────────────────────

function GalleryLayoutView({
  layout,
  images,
  username,
}: {
  layout: GalleryLayout;
  images: Space[];
  username: string;
}) {
  if (layout === "carousel") return <CarouselLayout images={images} username={username} />;
  if (layout === "masonry") return <MasonryLayout images={images} username={username} />;
  if (layout === "justified") return <JustifiedLayout images={images} username={username} />;
  if (layout === "featured") return <FeaturedLayout images={images} username={username} />;
  return <GridLayout images={images} username={username} />;
}

function tileHref(username: string, space: Space) {
  return `/${username}/space/${space.id}`;
}

// ── Tile captions ────────────────────────────────────────────────────────────

const CaptionStyleContext = createContext<GalleryCaptionStyle>("none");

type CaptionSize = "sm" | "md" | "lg";

const CAPTION_TEXT: Record<CaptionSize, { title: string; description: string }> = {
  // Captions show up to 3 lines everywhere, small tiles included.
  sm: {
    title: "text-xs sm:text-sm",
    description: "text-[11px] sm:text-xs line-clamp-3",
  },
  md: { title: "text-sm", description: "text-xs line-clamp-3" },
  lg: { title: "text-base sm:text-lg", description: "text-xs sm:text-sm line-clamp-3" },
};

const CAPTION_PAD: Record<CaptionSize, string> = {
  sm: "p-1.5 sm:p-3",
  md: "p-3",
  lg: "p-4 sm:p-5",
};

/**
 * The photo's title + caption over the bottom of a tile, in the owner's chosen
 * style. Must sit inside a `group relative` tile. Renders nothing when the
 * style is 'none' or the photo has neither title nor caption.
 */
function TileCaption({ space, size = "md" }: { space: Space; size?: CaptionSize }) {
  const style = useContext(CaptionStyleContext);
  if (style === "none") return null;
  const title = space.title?.trim();
  const description = space.description?.trim();
  if (!title && !description) return null;

  const text = CAPTION_TEXT[size];
  const body = (
    <>
      {title && <p className={`${text.title} font-semibold leading-snug line-clamp-1`}>{title}</p>}
      {description && (
        <p className={`${text.description} leading-snug text-white/80 ${title ? "mt-0.5" : ""}`}>
          {description}
        </p>
      )}
    </>
  );

  if (style === "card") {
    const inset = size === "sm" ? "inset-x-1 bottom-1 sm:inset-x-2 sm:bottom-2" : "inset-x-2 bottom-2 sm:inset-x-3 sm:bottom-3";
    const pad = size === "sm" ? "px-1.5 py-1 sm:px-3 sm:py-2" : "px-3 py-2";
    return (
      <div className={`pointer-events-none absolute ${inset}`}>
        <div className={`rounded-md border border-white/15 bg-black/45 text-white shadow-lg backdrop-blur-md sm:rounded-lg ${pad}`}>
          {body}
        </div>
      </div>
    );
  }

  if (style === "hover") {
    // Revealed on hover/focus; touch screens can't hover, so there it falls
    // back to an always-on bottom gradient instead of hiding the text.
    return (
      <div
        className={`pointer-events-none absolute inset-0 flex flex-col justify-end bg-black/60 text-white opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:bg-transparent [@media(hover:none)]:bg-gradient-to-t [@media(hover:none)]:from-black/75 [@media(hover:none)]:via-transparent [@media(hover:none)]:opacity-100 ${CAPTION_PAD[size]}`}
      >
        <div className="transition-transform duration-200 ease-out motion-safe:translate-y-1 motion-safe:group-hover:translate-y-0">
          {body}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent text-white ${size === "sm" ? "pt-6" : "pt-10"} ${CAPTION_PAD[size]}`}
    >
      {body}
    </div>
  );
}

/** Single horizontal row that scrolls sideways (portrait tiles). */
function CarouselLayout({ images, username }: { images: Space[]; username: string }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto scroll-smooth px-1 pb-6 snap-x snap-mandatory scrollbar-hide">
      {images.map((space, i) => (
        <HoverPrefetchLink
          key={space.id}
          href={tileHref(username, space)}
          className="group relative block aspect-[3/4] w-[160px] shrink-0 snap-start overflow-hidden rounded-lg bg-muted sm:w-[200px]"
        >
          <Image
            src={imageSrc(space)!}
            alt={spaceDisplayTitle(space)}
            fill
            sizes="200px"
            className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
            priority={i === 0}
          />
          <TileCaption space={space} />
        </HoverPrefetchLink>
      ))}
    </div>
  );
}

/** Uniform square thumbnails (Instagram-style). */
function GridLayout({ images, username }: { images: Space[]; username: string }) {
  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-2 pb-6">
      {images.map((space) => (
        <HoverPrefetchLink
          key={space.id}
          href={tileHref(username, space)}
          className="group relative block aspect-square overflow-hidden rounded-md sm:rounded-lg bg-muted"
        >
          <Image
            src={imageSrc(space)!}
            alt={spaceDisplayTitle(space)}
            fill
            sizes="(max-width: 640px) 33vw, (max-width: 1280px) 30vw, 400px"
            className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
          />
          <TileCaption space={space} size="sm" />
        </HoverPrefetchLink>
      ))}
    </div>
  );
}

/** Pinterest-style columns preserving natural aspect ratios. */
function MasonryLayout({ images, username }: { images: Space[]; username: string }) {
  // No stored dimensions: each tile reserves a 4:5 box (so the page doesn't
  // jump from 0px as images stream in), then adopts the real ratio on load.
  const [ratios, setRatios] = useState<Record<string, number>>({});
  return (
    <div className="columns-2 gap-2 sm:columns-3 [&>*]:mb-2 pb-6">
      {images.map((space) => (
        <HoverPrefetchLink
          key={space.id}
          href={tileHref(username, space)}
          className="group relative block break-inside-avoid overflow-hidden rounded-md sm:rounded-lg bg-muted"
          style={{ aspectRatio: ratios[space.id] ?? 0.8 }}
        >
          <Image
            src={imageSrc(space)!}
            alt={spaceDisplayTitle(space)}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 30vw, 400px"
            className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
            onLoad={(e) => {
              const img = e.currentTarget;
              if (!img.naturalHeight) return;
              const r = img.naturalWidth / img.naturalHeight;
              setRatios((prev) => (prev[space.id] === r ? prev : { ...prev, [space.id]: r }));
            }}
          />
          <TileCaption space={space} size="sm" />
        </HoverPrefetchLink>
      ))}
    </div>
  );
}

/**
 * Flickr-style justified rows: every row fills the full width, all images in a
 * row share the same height. No image dimensions are stored, so natural aspect
 * ratios are measured on load (defaulting to 3:2 until measured, which causes a
 * minor first-paint reflow) and rows are packed against the measured container
 * width.
 */
const TARGET_ROW_HEIGHT = 220;
const JUSTIFIED_GAP = 8;
const DEFAULT_RATIO = 1.5;

function JustifiedLayout({ images, username }: { images: Space[]; username: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [ratios, setRatios] = useState<Record<string, number>>({});

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo(() => {
    if (containerWidth <= 0) return [] as { space: Space; width: number; height: number }[][];
    const out: { space: Space; width: number; height: number }[][] = [];
    let current: { space: Space; ratio: number }[] = [];
    let ratioSum = 0;

    const flush = (isLast: boolean) => {
      if (current.length === 0) return;
      const totalGap = JUSTIFIED_GAP * (current.length - 1);
      // Height that makes this row's images exactly fill the width.
      const fittedHeight = (containerWidth - totalGap) / ratioSum;
      const height = isLast ? Math.min(fittedHeight, TARGET_ROW_HEIGHT) : fittedHeight;
      out.push(
        current.map(({ space, ratio }) => ({ space, width: ratio * height, height }))
      );
      current = [];
      ratioSum = 0;
    };

    for (const space of images) {
      const ratio = ratios[space.id] ?? DEFAULT_RATIO;
      current.push({ space, ratio });
      ratioSum += ratio;
      const rowWidth = ratioSum * TARGET_ROW_HEIGHT + JUSTIFIED_GAP * (current.length - 1);
      if (rowWidth >= containerWidth) flush(false);
    }
    flush(true);
    return out;
  }, [images, ratios, containerWidth]);

  const handleLoad = useCallback(
    (id: string, e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      if (!img.naturalHeight) return;
      const r = img.naturalWidth / img.naturalHeight;
      setRatios((prev) => (prev[id] === r ? prev : { ...prev, [id]: r }));
    },
    []
  );

  // Before the container is measured (server render + first paint) show a
  // CSS-only approximation of justified rows, so the gallery is in the HTML
  // (SEO/LCP) and doesn't pop in after hydration, pushing the page down. Once
  // measured, the exact rows take over; images then report natural ratios.
  if (containerWidth <= 0) {
    return (
      <div ref={containerRef} className="flex flex-wrap gap-2 pb-6">
        {images.map((space) => (
          <HoverPrefetchLink
            key={space.id}
            href={tileHref(username, space)}
            className="group relative block h-[220px] grow basis-[330px] overflow-hidden rounded-md sm:rounded-lg bg-muted"
          >
            <Image
              src={imageSrc(space)!}
              alt={spaceDisplayTitle(space)}
              fill
              sizes="(max-width: 640px) 100vw, 400px"
              className="object-cover"
              onLoad={(e) => handleLoad(space.id, e)}
            />
            <TileCaption space={space} />
          </HoverPrefetchLink>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-2 pb-6">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          {row.map(({ space, width, height }) => (
            <HoverPrefetchLink
              key={space.id}
              href={tileHref(username, space)}
              className="group relative block overflow-hidden rounded-md sm:rounded-lg bg-muted"
              style={{ width, height }}
            >
              <Image
                src={imageSrc(space)!}
                alt={spaceDisplayTitle(space)}
                fill
                sizes="(max-width: 640px) 100vw, 400px"
                className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
                onLoad={(e) => handleLoad(space.id, e)}
              />
              <TileCaption space={space} />
            </HoverPrefetchLink>
          ))}
        </div>
      ))}
    </div>
  );
}

/** First image as a wide hero, the rest in the uniform grid. */
function FeaturedLayout({ images, username }: { images: Space[]; username: string }) {
  const [hero, ...rest] = images;
  return (
    <div className="pb-6">
      <HoverPrefetchLink
        href={tileHref(username, hero)}
        className="group relative mb-2 block aspect-[16/9] overflow-hidden rounded-lg sm:rounded-xl bg-muted"
      >
        <Image
          src={imageSrc(hero)!}
          alt={spaceDisplayTitle(hero)}
          fill
          sizes="(max-width: 1024px) 100vw, 66vw"
          className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
          priority
        />
        <TileCaption space={hero} size="lg" />
      </HoverPrefetchLink>
      {rest.length > 0 && <GridLayout images={rest} username={username} />}
    </div>
  );
}
