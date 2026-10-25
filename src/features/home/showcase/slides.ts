export type SlideKind = "hero" | "anatomy" | "content" | "booking" | "style" | "links" | "gallery";

export type Slide = {
  kind: SlideKind;
  steps: number; // sub-steps the phone + guide list walk through
  stepMs: number;
  compactStepMs: number; // below lg: just the phone and a one-line caption to read
  annotated?: boolean; // shows callout lines next to the phone
};

// Order = carousel order. Each slide lingers TAIL_MS on its last step.
export const SLIDES: Slide[] = [
  { kind: "hero", steps: 1, stepMs: 6500, compactStepMs: 4000 },
  { kind: "anatomy", steps: 4, stepMs: 2400, compactStepMs: 1600, annotated: true },
  { kind: "content", steps: 4, stepMs: 2400, compactStepMs: 1600, annotated: true },
  // Booking's taps are timed off the step (see BookingScreen): the first step's
  // Continue has to land after its service tap, so it can't go much lower.
  { kind: "booking", steps: 5, stepMs: 2600, compactStepMs: 2300 },
  { kind: "style", steps: 4, stepMs: 2400, compactStepMs: 1600 },
  { kind: "links", steps: 1, stepMs: 5500, compactStepMs: 3500 },
  { kind: "gallery", steps: 1, stepMs: 5500, compactStepMs: 3500 },
];

export const TAIL_MS = 1200;

export function stepMsOf(slide: Slide, compact: boolean) {
  return compact ? slide.compactStepMs : slide.stepMs;
}

export function slideDuration(slide: Slide, compact: boolean) {
  return slide.steps * stepMsOf(slide, compact) + (slide.steps > 1 ? TAIL_MS : 0);
}

// Callout anchors per annotated slide, one per step (matches `data-anchor`).
export const ANCHORS: Partial<Record<SlideKind, string[]>> = {
  anatomy: ["profile", "book", "address", "gallery"],
  content: ["socials", "publications", "links", "follow"],
};

// Phone design size (px). Screens are laid out at this fixed size so callout
// anchors and scroll offsets stay exact at every breakpoint.
export const PHONE = { width: 280, height: 576, bezel: 8 } as const;
export const SCREEN = { width: PHONE.width - PHONE.bezel * 2, height: PHONE.height - PHONE.bezel * 2 } as const;
