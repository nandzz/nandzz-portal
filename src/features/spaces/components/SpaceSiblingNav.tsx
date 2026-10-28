"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface SpaceSiblingNavProps {
  /** null = no sibling on that side (arrow hidden, key ignored). */
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  pending: boolean;
}

/**
 * Prev/next arrows (desktop only — mobile swipes) + ←/→ keys for browsing
 * sibling spaces in the viewer.
 * Rendered as an overlay inside the (relative) content area.
 */
export function SpaceSiblingNav({ onPrev, onNext, pending }: SpaceSiblingNavProps) {
  const { t } = useLanguage();

  useEffect(() => {
    if (!onPrev && !onNext) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='dialog']")) return;
      if (e.key === "ArrowLeft") onPrev?.();
      else if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext]);

  const arrowClass =
    "absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-[background-color,transform] hover:bg-black/60 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 md:flex";

  return (
    <>
      {pending && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20" aria-hidden>
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}
      {onPrev && (
        <button type="button" onClick={onPrev} aria-label={t.space.previousItem} className={cn(arrowClass, "left-3")}>
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {onNext && (
        <button type="button" onClick={onNext} aria-label={t.space.nextItem} className={cn(arrowClass, "right-3")}>
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </>
  );
}
