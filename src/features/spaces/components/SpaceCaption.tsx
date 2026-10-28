"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface SpaceCaptionProps {
  title: string;
  description: string | null;
}

/**
 * Title + description under an image in the viewer. The description is
 * clamped to two lines with a "more" toggle when it overflows; expanded it
 * grows up to ~40% of the screen and scrolls. Remount per space (key by id).
 */
export function SpaceCaption({ title, description }: SpaceCaptionProps) {
  const { t } = useLanguage();
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const heading = title.trim();
  const body = description?.trim() ?? "";

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [body, expanded]);

  if (!heading && !body) return null;

  return (
    <div className="shrink-0 border-t border-white/10 bg-black/90 pt-3 pb-4 text-white">
      {/* Same container as the top bar, so the caption lines up with the title there. */}
      <div className="mx-auto max-w-7xl pl-4 pr-6 [&>*]:max-w-2xl">
        {heading && <h2 className="text-base font-semibold leading-snug text-balance">{heading}</h2>}
        {body && (
          <div className={cn(heading && "mt-1")}>
            <p
              ref={textRef}
              className={cn(
                "text-sm leading-relaxed text-white/80 whitespace-pre-line break-words",
                expanded ? "max-h-[40dvh] overflow-y-auto overscroll-contain" : "line-clamp-2"
              )}
            >
              {body}
            </p>
            {(overflows || expanded) && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="mt-1 text-sm font-medium text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:underline"
              >
                {expanded ? t.space.captionLess : t.space.captionMore}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
