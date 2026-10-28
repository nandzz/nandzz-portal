"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";

// Width (px) the screen is laid out at, per viewport. The real components pick
// their layout from viewport breakpoints, not from the frame, so on a wide
// viewport they'd lay out for desktop inside a ~600px window and squeeze. The
// screen is rendered at a desktop-sized width instead and scaled down to fit.
function designWidth(frameWidth: number) {
  if (window.matchMedia("(min-width: 1024px)").matches) return Math.max(frameWidth, 1000); // lg layouts
  if (window.matchMedia("(min-width: 640px)").matches) return Math.max(frameWidth, 720); // sm layouts
  return frameWidth; // phone layouts fit as they are
}

// A desktop browser window around a live mock of the dashboard. The body has a
// fixed height and never scrolls (no component scrollbars): a screen that's
// taller than the window is cut off under a soft fade, or moves itself.
// The content is inert, so the real components inside can't be clicked into
// (no actions, no navigation) or reached with Tab.
export function BrowserFrame({ path, children }: { path: string; children: ReactNode }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; height: number; scale: number } | null>(null);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () => {
      const width = designWidth(body.clientWidth);
      const scale = body.clientWidth / width;
      setBox({ width, height: body.clientHeight / scale, scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    return () => ro.disconnect();
  }, []);

  return (
    <div aria-hidden className="clay overflow-hidden rounded-[1.75rem] p-1.5">
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="clay-well mx-auto flex min-w-0 max-w-sm flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs text-[color-mix(in_oklab,var(--clay-ink)_60%,transparent)]">
          <Lock className="h-3 w-3 shrink-0" />
          <span className="truncate">nandzz.com{path}</span>
        </span>
        <span className="w-[42px]" />
      </div>
      <div
        ref={bodyRef}
        inert
        className="relative h-[34rem] overflow-hidden rounded-[1.35rem] bg-background text-foreground select-none sm:h-[36rem]"
      >
        {box && (
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: box.width, height: box.height, transform: `scale(${box.scale})` }}
          >
            {children}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div>
    </div>
  );
}
