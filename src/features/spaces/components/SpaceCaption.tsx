"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface SpaceCaptionProps {
  description: string | null;
}

/**
 * Description under an image in the viewer (the title already lives in the
 * top bar). Collapsed, blank lines are squashed and the text is clamped to
 * three lines with a "more" toggle when it overflows; expanded it shows the
 * original formatting, grows up to ~40% of the screen and scrolls. Remount
 * per space (key by id).
 */
export function SpaceCaption({ description }: SpaceCaptionProps) {
  const { t } = useLanguage();
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const body = description?.trim() ?? "";
  // A blank second line would otherwise leave the clamp showing just "…".
  const preview = body.replace(/\n\s*\n+/g, "\n");

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [preview, expanded]);

  if (!body) return null;

  return (
    <div className="shrink-0 border-t border-white/10 bg-black/90 pt-3 pb-4 text-white">
      {/* Same container as the top bar, so the caption lines up with the title there. */}
      <div className="mx-auto max-w-7xl pl-4 pr-6 [&>*]:max-w-2xl">
        <div>
          <p
            ref={textRef}
            className={cn(
              "text-sm leading-relaxed text-white/80 whitespace-pre-line break-words",
              expanded ? "max-h-[40dvh] overflow-y-auto overscroll-contain" : "line-clamp-3"
            )}
          >
            {expanded ? body : preview}
          </p>
          {(overflows || expanded) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {expanded ? t.space.captionLess : t.space.captionMore}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
