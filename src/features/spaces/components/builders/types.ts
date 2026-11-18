import type { ContentTypeId } from "@/lib/spaces/content-types";
import type { Space } from "@/lib/types";

/** The content types that have a builder. Excludes legacy `html` (metadata-only
 * editor) and `video` (merged into the unified `link` builder). */
export type CreatableContentTypeId = Exclude<ContentTypeId, "html" | "video" | "ai">;

/** Props every per-type builder component (registry entry) receives. */
export interface BuilderFieldsProps {
  space?: Space;
  collectionId?: string;
}

/**
 * Context passed into a builder's `buildTypePayload` at submit time — values
 * that live in the shared `useContentBuilderForm` hook but that a builder's
 * payload construction may need (e.g. the AI builder embeds `title` in its
 * generated stub HTML; the video builder skips a Vimeo oEmbed round-trip
 * when the user already picked a manual preview).
 */
export interface BuildTypePayloadContext {
  userId: string;
  title: string;
  hasManualPreview: boolean;
}
