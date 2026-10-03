import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  LayoutDashboard,
  GalleryHorizontal,
  GalleryHorizontalEnd,
  GalleryThumbnails,
} from "lucide-react";
import type { Profile } from "@/lib/types";
import type { Translations } from "@/lib/i18n/translations";

/** Every arrangement a profile section can be displayed in. */
export type SectionLayout = "carousel" | "grid" | "masonry" | "justified" | "featured";

/** Back-compat alias — the image gallery was the first section to gain layouts. */
export type GalleryLayout = SectionLayout;

/** Layouts offered for the image gallery (ordered for the settings menu). */
export const GALLERY_LAYOUTS: SectionLayout[] = [
  "carousel",
  "grid",
  "masonry",
  "justified",
  "featured",
];

/** Layouts offered for the card/chip sections (Publications, Links). 'masonry'
 * is image-only so it's excluded here. */
export const CARD_LAYOUTS: SectionLayout[] = ["carousel", "grid", "justified", "featured"];

export const SECTION_LAYOUT_ICONS: Record<SectionLayout, LucideIcon> = {
  carousel: GalleryHorizontalEnd,
  grid: LayoutGrid,
  masonry: GalleryThumbnails,
  justified: GalleryHorizontal,
  featured: LayoutDashboard,
};

function isSectionLayout(
  value: string | null | undefined,
  allowed: SectionLayout[],
): value is SectionLayout {
  return typeof value === "string" && (allowed as string[]).includes(value);
}

/** Narrows a profile's stored `gallery_layout` to a valid layout (default grid). */
export function resolveGalleryLayout(profile: Pick<Profile, "gallery_layout">): SectionLayout {
  return isSectionLayout(profile.gallery_layout, GALLERY_LAYOUTS)
    ? profile.gallery_layout
    : "grid";
}

/** Narrows a profile's stored `contents_layout` (default carousel). */
export function resolveContentsLayout(profile: Pick<Profile, "contents_layout">): SectionLayout {
  return isSectionLayout(profile.contents_layout, CARD_LAYOUTS)
    ? profile.contents_layout
    : "carousel";
}

/** Narrows a profile's stored `links_layout` (default carousel). */
export function resolveLinksLayout(profile: Pick<Profile, "links_layout">): SectionLayout {
  return isSectionLayout(profile.links_layout, CARD_LAYOUTS) ? profile.links_layout : "carousel";
}

/** Resolves a layout's display label from the current locale's translations. */
export function getSectionLayoutLabel(t: Translations, id: SectionLayout): string {
  const labels: Record<SectionLayout, string> = {
    carousel: t.profile.layoutCarousel,
    grid: t.profile.layoutGrid,
    masonry: t.profile.layoutMasonry,
    justified: t.profile.layoutJustified,
    featured: t.profile.layoutFeatured,
  };
  return labels[id];
}

// ── Section ordering ─────────────────────────────────────────────────────────

/** The three orderable sections of the public profile. */
export type SectionId = "gallery" | "publications" | "links";

export const DEFAULT_SECTION_ORDER: SectionId[] = ["gallery", "publications", "links"];

function isSectionId(value: string): value is SectionId {
  return value === "gallery" || value === "publications" || value === "links";
}

/**
 * Narrows the stored `section_order` to a complete, de-duplicated ordering of
 * all three sections. Unknown/duplicate ids are dropped and any section missing
 * from the stored value is appended in its default position, so the result is
 * always exactly the three sections in some order.
 */
export function resolveSectionOrder(profile: Pick<Profile, "section_order">): SectionId[] {
  const stored = Array.isArray(profile.section_order) ? profile.section_order : [];
  const seen = new Set<SectionId>();
  const order: SectionId[] = [];
  for (const raw of stored) {
    if (isSectionId(raw) && !seen.has(raw)) {
      seen.add(raw);
      order.push(raw);
    }
  }
  for (const id of DEFAULT_SECTION_ORDER) {
    if (!seen.has(id)) order.push(id);
  }
  return order;
}
