import dynamic from "next/dynamic";
import type { TourChapter } from "../types";

// The cards, profile sections and their dependencies load only once the tour
// shows this chapter, never with the guide page itself.
const Screen = dynamic(() => import("./Screen").then((m) => m.ContentsScreen), { ssr: false });

// step: 0 overview · 1 gallery tab · 2 links tab · 3 create picker · 4 visibility · 5 public profile
const PATHS = [
  "/dashboard/contents",
  "/dashboard/contents",
  "/dashboard/contents",
  "/dashboard/contents/create-space",
  "/dashboard/contents",
  "/studiolume",
];

export const contentsChapter: TourChapter = {
  id: "contents",
  path: (step) => PATHS[step] ?? PATHS[0],
  Screen,
};
