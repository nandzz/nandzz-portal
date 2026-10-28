"use client";

import dynamic from "next/dynamic";
import type { TourChapter } from "../types";

// The screen pulls in the real booking managers; keep them out of the guide's
// first-load bundle and the server render.
const Screen = dynamic(() => import("./Screen").then((m) => m.BookingScreen), { ssr: false });

const PATHS = [
  "/dashboard/booking",
  "/dashboard/booking/services",
  "/dashboard/booking/staff",
  "/dashboard/booking/availability",
  "/studiolume/booking",
  "/studiolume/booking",
];

export const bookingChapter: TourChapter = {
  id: "booking",
  path: (step) => PATHS[step] ?? PATHS[0],
  Screen,
};
