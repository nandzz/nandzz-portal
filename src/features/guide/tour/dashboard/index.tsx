import dynamic from "next/dynamic";
import type { TourChapter } from "../types";
import { STEPS } from "./steps";

// The screen pulls in the real dashboard tabs (charts, formatters), so it loads
// on the client only and never weighs on the guide page's first paint.
const Screen = dynamic(() => import("./Screen"), { ssr: false });

// Back office, day to day: the booking dashboard tabs on sample data.
export const dashboardChapter: TourChapter = {
  id: "dashboard",
  path: (step) => `/dashboard/booking/${(STEPS[step] ?? STEPS[0]).segment}`,
  Screen,
};
