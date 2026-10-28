import type { TourChapter } from "./types";
import { dashboardChapter } from "./dashboard";
import { bookingChapter } from "./booking";
import { contentsChapter } from "./contents";

// Order = chapter switch order (and autoplay order).
export const TOUR_CHAPTERS: TourChapter[] = [dashboardChapter, bookingChapter, contentsChapter];
