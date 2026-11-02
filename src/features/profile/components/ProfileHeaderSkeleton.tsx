"use client";

import { useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import type { HeaderLayout } from "@/lib/types";
import {
  BANNER_OFFSET,
  CARD_OFFSET,
  COVER_BASE,
  COVER_HEIGHT,
  HERO_MIN_HEIGHT,
  recallHeaderLayout,
} from "../domain/header-layout";

const PULSE = "bg-muted motion-safe:animate-pulse";
const noop = () => () => {};

// Loading frame for /[username]: draws the header in the layout this browser
// last saw for that profile (remembered by ProfileHeader), so the skeleton →
// page swap doesn't jump. The server render (and a first visit) is "centered".
// The skeleton isn't pulled up under the navbar, so --cover-top is 0 here.
export function ProfileSkeletonFrame({ children }: { children: React.ReactNode }) {
  const { username } = useParams<{ username: string }>();
  const layout = useSyncExternalStore<HeaderLayout>(
    noop,
    () => recallHeaderLayout(decodeURIComponent(username ?? "")),
    () => "centered",
  );

  return (
    <div className={`relative min-h-[calc(100vh-8rem)] [--cover-top:0px] ${COVER_BASE[layout]}`}>
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        {layout === "centered" ? (
          // Violet blur circle like the real no-cover state
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-violet-100/40 blur-3xl dark:bg-violet-950/20" />
        ) : (
          <div className={`absolute inset-x-0 top-0 ${COVER_HEIGHT} ${PULSE}`} />
        )}
      </div>

      <PageShell width="wide">
        <HeaderShape layout={layout} />
        {children}
      </PageShell>
    </div>
  );
}

const Bars = ({ align }: { align: "center" | "start" }) => (
  <>
    <div className={`mt-2 h-4 w-52 max-w-[75vw] rounded ${PULSE}`} />
    <div className={`mt-3 flex w-full flex-col space-y-2 ${align === "center" ? "items-center px-4" : "items-start"}`}>
      <div className={`h-4 w-72 max-w-full rounded ${PULSE}`} />
      <div className={`h-4 w-56 max-w-[90%] rounded ${PULSE}`} />
    </div>
    <div className="mt-5 flex items-center gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={`h-9 w-9 rounded-lg ${PULSE}`} />
      ))}
    </div>
  </>
);

// Mirrors ProfileHeader's per-layout geometry (same offsets/sizes).
function HeaderShape({ layout }: { layout: HeaderLayout }) {
  if (layout === "banner") {
    return (
      <div className={`flex flex-col items-start ${BANNER_OFFSET}`}>
        <div className="h-24 w-24 rounded-full border-4 border-background bg-muted shadow-xl md:h-28 md:w-28" />
        <div className={`mt-3 h-7 w-44 max-w-[80vw] rounded ${PULSE}`} />
        <div className={`mt-1.5 h-4 w-28 max-w-[60vw] rounded ${PULSE}`} />
        <Bars align="start" />
      </div>
    );
  }

  if (layout === "card") {
    return (
      <div className={`mx-auto max-w-2xl rounded-3xl border border-border/50 bg-background px-5 pb-7 shadow-xl sm:px-8 ${CARD_OFFSET}`}>
        <div className="flex flex-col items-center">
          <div className="-mt-12 h-24 w-24 rounded-full border-4 border-background bg-muted shadow-xl md:-mt-14 md:h-28 md:w-28" />
          <div className={`mt-4 h-7 w-44 max-w-[80vw] rounded ${PULSE}`} />
          <div className={`mt-1.5 h-4 w-28 max-w-[60vw] rounded ${PULSE}`} />
          <Bars align="center" />
        </div>
      </div>
    );
  }

  if (layout === "hero") {
    return (
      <>
        <div className={`flex flex-col justify-end pb-6 ${HERO_MIN_HEIGHT}`}>
          <div className="flex items-end gap-4">
            <div className="h-20 w-20 rounded-full border-4 border-background/80 bg-background/40 md:h-24 md:w-24" />
            <div className="pb-1">
              <div className="h-7 w-44 max-w-[50vw] rounded bg-background/50" />
              <div className="mt-1.5 h-4 w-28 rounded bg-background/40" />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start">
          <Bars align="start" />
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="h-28 w-28 rounded-full bg-muted motion-safe:animate-pulse border-4 border-background shadow-xl" />
      <div className={`mt-5 h-7 w-44 max-w-[80vw] rounded ${PULSE}`} />
      <div className={`mt-1.5 h-4 w-28 max-w-[60vw] rounded ${PULSE}`} />
      <Bars align="center" />
    </div>
  );
}
