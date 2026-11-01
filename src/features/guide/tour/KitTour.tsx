"use client";

import { TourBusinessProvider, type TourBusiness } from "./business";
import { TOUR_CHAPTERS } from "./chapters";
import type { GuideTourChapterId } from "../content";

// One tour screen, full-bleed and frameless, for product captures (videos,
// ads): the same screens as the /guide tour, on a demo business's own setup
// when there is one. Inert like the tour's frame: display only, so the managers'
// save pill is hidden too.
export function KitTour({
  business,
  chapter,
  step,
}: {
  business: TourBusiness | null;
  chapter: GuideTourChapterId;
  step: number;
}) {
  const { id, Screen } = TOUR_CHAPTERS.find((c) => c.id === chapter) ?? TOUR_CHAPTERS[0];
  return (
    <TourBusinessProvider business={business}>
      <div
        inert
        data-kit-screen={`${id}-${step}`}
        className="h-dvh w-full overflow-hidden bg-background text-foreground select-none [&_[data-save-bar]]:hidden"
      >
        <Screen step={step} />
      </div>
    </TourBusinessProvider>
  );
}
