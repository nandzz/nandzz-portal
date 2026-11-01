import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KitTour } from "@/features/guide";
import { getKitBusiness } from "@/features/guide/server";

// Capture-only screens for the demo videos (marketing/design-system/product-ui):
//   /kit/tour?chapter=dashboard|booking&step=N[&page=<demo username>]
// Without `page` it shows Studio Lume, like /guide. Never indexed.
export const metadata: Metadata = {
  title: { absolute: "Nandzz" },
  robots: { index: false, follow: false },
};

const CHAPTERS = ["dashboard", "booking"] as const;
type KitChapter = (typeof CHAPTERS)[number];
const MAX_STEP = 5;

export default async function KitTourPage({
  searchParams,
}: {
  searchParams: Promise<{ chapter?: string; step?: string; page?: string }>;
}) {
  const { chapter = "dashboard", step = "0", page } = await searchParams;
  if (!CHAPTERS.includes(chapter as KitChapter)) notFound();
  const n = Math.min(MAX_STEP, Math.max(0, Number.parseInt(step, 10) || 0));

  const business = page ? await getKitBusiness(page) : null;
  if (page && !business) notFound();

  return <KitTour business={business} chapter={chapter as KitChapter} step={n} />;
}
