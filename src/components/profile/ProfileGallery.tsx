"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Space, Profile } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { GalleryModal } from "@/features/profile";
import { SectionOwnerMenu } from "./SectionOwnerMenu";
import { SeeMoreLink } from "./SeeMoreLink";
import { persistProfileUpdate } from "@/lib/profile/update";
import { GALLERY_LAYOUTS, type GalleryLayout } from "@/lib/gallery/layouts";

interface ProfileGalleryProps {
  images: Space[];
  totalCount: number;
  profile: Profile;
  isOwner: boolean;
  initialLayout: GalleryLayout;
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
  seeMoreHref,
  enableModal,
}: ProfileGalleryProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [layout, setLayout] = useState<GalleryLayout>(initialLayout);
  const [modalOpen, setModalOpen] = useState(false);

  // Keep local layout in sync if the server re-renders with a fresh value
  // (React's recommended "adjust state during render" pattern — no effect).
  const [prevInitial, setPrevInitial] = useState(initialLayout);
  if (initialLayout !== prevInitial) {
    setPrevInitial(initialLayout);
    setLayout(initialLayout);
  }

  const withImage = useMemo(() => images.filter((s) => imageSrc(s)), [images]);

  const handleLayoutChange = useCallback(
    async (value: GalleryLayout) => {
      setLayout(value); // optimistic
      try {
        await persistProfileUpdate(profile.id, profile.username, { gallery_layout: value });
        router.refresh();
      } catch {
        setLayout(initialLayout); // revert on failure
      }
    },
    [profile.id, profile.username, initialLayout, router]
  );

  if (withImage.length === 0) return null;

  const showSeeMore = totalCount > withImage.length;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-lg font-semibold"
          style={profile.text_color ? { color: profile.text_color } : undefined}
        >
          {t.profile.galleryTitle}
          <span
            className="ml-1.5 text-sm font-normal text-muted-foreground tabular-nums"
            style={profile.text_color ? { color: profile.text_color, opacity: 0.65 } : undefined}
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
          />
        )}
      </div>

      <GalleryLayoutView layout={layout} images={withImage} username={profile.username} />

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

/** Single horizontal row that scrolls sideways (portrait tiles). */
function CarouselLayout({ images, username }: { images: Space[]; username: string }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto scroll-smooth px-1 pb-6 snap-x snap-mandatory scrollbar-hide">
      {images.map((space, i) => (
        <Link
          key={space.id}
          href={tileHref(username, space)}
          className="group relative block aspect-[3/4] w-[160px] shrink-0 snap-start overflow-hidden rounded-lg bg-muted sm:w-[200px]"
        >
          <Image
            src={imageSrc(space)!}
            alt={space.title}
            fill
            sizes="200px"
            className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
            priority={i === 0}
          />
        </Link>
      ))}
    </div>
  );
}

/** Uniform square thumbnails (Instagram-style). */
function GridLayout({ images, username }: { images: Space[]; username: string }) {
  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-2 pb-6">
      {images.map((space) => (
        <Link
          key={space.id}
          href={tileHref(username, space)}
          className="group relative block aspect-square overflow-hidden rounded-md sm:rounded-lg bg-muted"
        >
          <Image
            src={imageSrc(space)!}
            alt={space.title}
            fill
            sizes="(max-width: 640px) 33vw, 30vw"
            className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
          />
        </Link>
      ))}
    </div>
  );
}

/** Pinterest-style columns preserving natural aspect ratios. */
function MasonryLayout({ images, username }: { images: Space[]; username: string }) {
  return (
    <div className="columns-2 gap-2 sm:columns-3 [&>*]:mb-2 pb-6">
      {images.map((space) => (
        <Link
          key={space.id}
          href={tileHref(username, space)}
          className="group block break-inside-avoid overflow-hidden rounded-md sm:rounded-lg bg-muted"
        >
          <Image
            src={imageSrc(space)!}
            alt={space.title}
            width={0}
            height={0}
            sizes="(max-width: 640px) 50vw, 30vw"
            className="h-auto w-full transition-transform duration-300 motion-safe:group-hover:scale-105"
          />
        </Link>
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

  // Before the container is measured (first paint), rows is empty and only the
  // ref container renders; the measure effect fires on mount and re-renders
  // with real rows, whose <Image>s then report their natural ratios on load.
  return (
    <div ref={containerRef} className="flex flex-col gap-2 pb-6">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          {row.map(({ space, width, height }) => (
            <Link
              key={space.id}
              href={tileHref(username, space)}
              className="group relative block overflow-hidden rounded-md sm:rounded-lg bg-muted"
              style={{ width, height }}
            >
              <Image
                src={imageSrc(space)!}
                alt={space.title}
                fill
                sizes="50vw"
                className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
                onLoad={(e) => handleLoad(space.id, e)}
              />
            </Link>
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
      <Link
        href={tileHref(username, hero)}
        className="group relative mb-2 block aspect-[16/9] overflow-hidden rounded-lg sm:rounded-xl bg-muted"
      >
        <Image
          src={imageSrc(hero)!}
          alt={hero.title}
          fill
          sizes="(max-width: 1024px) 100vw, 66vw"
          className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
          priority
        />
      </Link>
      {rest.length > 0 && <GridLayout images={rest} username={username} />}
    </div>
  );
}
