"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { loadGalleryPage } from "../actions/load-gallery-page";
import type { Space } from "@/lib/types";
import { spaceDisplayTitle } from "@/lib/spaces/display-title";
import { useModalA11y } from "@/lib/useModalA11y";

const PAGE_SIZE = 12;

const imageSrc = (space: Space) => space.preview_image_url ?? space.image_url;

interface GalleryModalProps {
  onClose: () => void;
  profileId: string;
  username: string;
  totalCount: number;
}

/**
 * Paginated "see all" gallery shown from the profile once there are more images
 * than the inline preview holds. Mounted only while open (so page state resets
 * per open). Fetches one page of image-type spaces at a time (public only,
 * newest first). Picking an image closes the modal and navigates to that space.
 */
export function GalleryModal({ onClose, profileId, username, totalCount }: GalleryModalProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [images, setImages] = useState<Space[]>([]);
  const [count, setCount] = useState(totalCount);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  // Fetch the current page whenever it changes.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the spinner while this page's fetch is in flight; resolved in the .then below.
    setLoading(true);
    setFailed(false);
    loadGalleryPage({ profileId, page })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setFailed(true);
          return;
        }
        const total = typeof result.count === "number" ? result.count : null;
        if (total !== null) setCount(total);
        // Content deleted while open → this page no longer exists; step back
        // to the last real one instead of showing an empty grid.
        const lastPage = Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE));
        if (total !== null && page > lastPage) {
          setPage(lastPage);
          return;
        }
        setImages(result.spaces.filter((s) => imageSrc(s)));
      })
      .catch((err) => {
        // Network drop / deploy skew: never leave the spinner up forever.
        console.error("[gallery] page load failed:", err);
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, profileId, attempt]);

  // Focus in + trapped, Escape closes, body scroll locked, focus restored.
  useModalA11y(dialogRef, onClose);

  const handleSelect = useCallback(
    (space: Space) => {
      onClose();
      router.push(`/${username}/space/${space.id}`);
    },
    [onClose, router, username]
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-modal-title"
        className="relative z-10 mx-4 flex max-h-[85dvh] w-full max-w-4xl flex-col"
      >
        <div className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-background shadow-xl">
          <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
            <h2 id="gallery-modal-title" className="text-lg font-semibold">
              {t.profile.galleryTitle}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground tabular-nums">
                {count}
              </span>
            </h2>
            <button
              onClick={onClose}
              aria-label={t.agent.close}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="scrollbar-hide relative min-h-[240px] flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {failed && !loading && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
                <p>{t.common.error}</p>
                <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  {t.common.retry}
                </Button>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((space) => (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => handleSelect(space)}
                  className="group relative block aspect-square overflow-hidden rounded-md bg-muted sm:rounded-lg"
                >
                  <Image
                    src={imageSrc(space)!}
                    alt={spaceDisplayTitle(space)}
                    fill
                    sizes="(max-width: 640px) 33vw, 22vw"
                    className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 border-t border-border/60 px-6 py-3">
              <Button
                variant="outline"
                size="sm"
                className="border-border/60"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t.explore.previous}
              </Button>
              <span className="px-3 text-sm text-muted-foreground">
                {t.explore.pageOf
                  .replace("{current}", String(page))
                  .replace("{total}", String(totalPages))}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="border-border/60"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t.explore.next}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
