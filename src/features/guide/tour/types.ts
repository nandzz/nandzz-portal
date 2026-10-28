import type { ComponentType } from "react";
import type { GuideTourChapterId } from "../content";

// What a chapter screen receives: the step the narration is on (0-based).
// Screens are rendered inside an inert frame, so they're display-only: drive
// everything shown from `step`, never from clicks.
export type TourScreenProps = { step: number };

export type TourChapter = {
  id: GuideTourChapterId;
  // Address shown in the frame's URL bar for a step (e.g. "/dashboard/booking").
  path: (step: number) => string;
  Screen: ComponentType<TourScreenProps>;
};
