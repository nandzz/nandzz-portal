import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  FileText,
  AlignLeft,
  ImageIcon,
  Video,
  Globe,
  Code,
} from "lucide-react";
import type { Space } from "@/lib/types";
import type { Translations } from "@/lib/i18n/translations";

/** The 7 content types a space can have. `html` is legacy-only (see below). */
export type ContentTypeId =
  | "ai"
  | "pdf"
  | "notes"
  | "image"
  | "video"
  | "link"
  | "html";

/** The 3 display sections the content-management grid groups types into. */
export type SectionId = "informative" | "gallery" | "links";

export const CONTENT_TYPES: Record<
  ContentTypeId,
  {
    id: ContentTypeId;
    section: SectionId;
    icon: LucideIcon;
    creatable: boolean;
  }
> = {
  ai: {
    id: "ai",
    section: "informative",
    icon: Sparkles,
    creatable: true,
  },
  pdf: {
    id: "pdf",
    section: "informative",
    icon: FileText,
    creatable: true,
  },
  notes: {
    id: "notes",
    section: "informative",
    icon: AlignLeft,
    creatable: true,
  },
  image: {
    id: "image",
    section: "gallery",
    icon: ImageIcon,
    creatable: true,
  },
  // Legacy-only: the video builder was merged into `link`. New video URLs are
  // stored as `content_type: "link"` (in the `url` column) and embedded at
  // render time via `detectVideo`. `video` stays in the union so old rows and
  // the legacy inference below still type-check; it is no longer creatable.
  video: {
    id: "video",
    section: "links",
    icon: Video,
    creatable: false,
  },
  link: {
    id: "link",
    section: "links",
    icon: Globe,
    creatable: true,
  },
  html: {
    id: "html",
    section: "informative",
    icon: Code,
    creatable: false,
  },
};

export const SECTIONS: Record<
  SectionId,
  {
    id: SectionId;
    types: ContentTypeId[];
  }
> = {
  informative: {
    id: "informative",
    types: ["html", "ai", "pdf", "notes"],
  },
  gallery: {
    id: "gallery",
    types: ["image"],
  },
  links: {
    id: "links",
    types: ["link"],
  },
};

/** Section ids in display order (Content, Gallery, Links). */
export const SECTION_ORDER: SectionId[] = ["informative", "gallery", "links"];

/** The `profiles` boolean column that gates each section's public visibility. */
export const SECTION_VISIBILITY_COLUMN: Record<
  SectionId,
  "show_contents" | "show_gallery" | "show_links"
> = {
  informative: "show_contents",
  gallery: "show_gallery",
  links: "show_links",
};

/** Resolves a content type's display label from the current locale's translations. */
export function getContentTypeLabel(t: Translations, id: ContentTypeId): string {
  const labels: Record<ContentTypeId, string> = {
    ai: t.contentTypes.aiLabel,
    pdf: t.contentTypes.pdfLabel,
    notes: t.contentTypes.notesLabel,
    image: t.contentTypes.imageLabel,
    video: t.contentTypes.videoLabel,
    link: t.contentTypes.linkLabel,
    html: t.contentTypes.htmlLabel,
  };
  return labels[id];
}

/** Resolves a content type's description from the current locale's translations. */
export function getContentTypeDescription(t: Translations, id: ContentTypeId): string {
  const descriptions: Record<ContentTypeId, string> = {
    ai: t.contentTypes.aiDescription,
    pdf: t.contentTypes.pdfDescription,
    notes: t.contentTypes.notesDescription,
    image: t.contentTypes.imageDescription,
    video: t.contentTypes.videoDescription,
    link: t.contentTypes.linkDescription,
    html: t.contentTypes.htmlDescription,
  };
  return descriptions[id];
}

/** Resolves a section's display label from the current locale's translations. */
export function getSectionLabel(t: Translations, id: SectionId): string {
  const labels: Record<SectionId, string> = {
    informative: t.contentSections.informativeLabel,
    gallery: t.contentSections.galleryLabel,
    links: t.contentSections.linksLabel,
  };
  return labels[id];
}

/** Resolves a section's description from the current locale's translations. */
export function getSectionDescription(t: Translations, id: SectionId): string {
  const descriptions: Record<SectionId, string> = {
    informative: t.contentSections.informativeDescription,
    gallery: t.contentSections.galleryDescription,
    links: t.contentSections.linksDescription,
  };
  return descriptions[id];
}

/**
 * Permanent defensive fallback for any row where `content_type` is null
 * (pre-migration rows, or any future write path that forgets to set it).
 * Mirrors `detectInitialMode` in SpaceForm.tsx exactly (same precedence
 * order), except the ambiguous/no-match case resolves to "html" here to
 * match the DB backfill and `publish_space_tx` behavior, rather than
 * SpaceForm's UI-only default of "ai" for a blank new-space form.
 */
function legacyDetectContentType(
  space: Pick<
    Space,
    "html_url" | "url" | "pdf_url" | "image_url" | "video_url" | "markdown_content"
  >
): ContentTypeId {
  if (space.markdown_content) return "notes";
  if (space.video_url) return "video";
  if (space.image_url) return "image";
  if (space.pdf_url) return "pdf";
  if (space.html_url) return "html";
  if (space.url) return "link";
  return "html";
}

/** Resolves a space's effective content type, falling back to inference for
 * legacy rows. `video` is collapsed into `link` (the video builder was merged
 * in): the edit page and section grouping treat every video row as a link. */
export function resolveContentType(space: Space): Exclude<ContentTypeId, "video"> {
  const type = space.content_type
    ? (space.content_type as ContentTypeId)
    : legacyDetectContentType(space);
  return type === "video" ? "link" : type;
}

/** Looks up which display section a content type belongs to. */
export function sectionForType(type: ContentTypeId): SectionId {
  return CONTENT_TYPES[type].section;
}
