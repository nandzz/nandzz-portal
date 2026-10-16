// Client-safe public API for the spaces feature.
//
// Slice 4a: card/grid display cluster + space lifecycle (delete / duplicate).
// Slice 4b: editors, builders, the AI assistant and the passive viewers.

// ── Display + lifecycle (4a) ────────────────────────────────────────────────
export { SpaceCard } from "./components/SpaceCard";
export { SpaceGrid } from "./components/SpaceGrid";
export { SpacePreview } from "./components/SpacePreview";
export { SpaceOwnerMenu } from "./components/SpaceOwnerMenu";
export { DeleteSpaceButton } from "./components/DeleteSpaceButton";
export { DuplicateSpaceButton } from "./components/DuplicateSpaceButton";
export { ShareButton } from "./components/ShareButton";
export { ShareMenu } from "./components/ShareMenu";

export { deleteSpace } from "./actions/delete-space";
export { duplicateSpace } from "./actions/duplicate-space";
export type { DeleteSpaceResult } from "./actions/delete-space";
export type { DuplicateSpaceResult } from "./actions/duplicate-space";

// ── Editors, viewers, builders (4b) ─────────────────────────────────────────
export { HtmlSpaceEditor } from "./components/HtmlSpaceEditor";
export { MarkdownSpaceEditor } from "./components/MarkdownSpaceEditor";
export { AiAssistantPanel } from "./components/AiAssistantPanel";
export { MarkdownViewer } from "./components/MarkdownViewer";
// NOTE: The raw `PdfViewer` is intentionally NOT re-exported here. It imports
// `react-pdf` (pdf.js) at module scope, which touches browser-only globals like
// `DOMMatrix` and crashes during SSR. Because a barrel statically evaluates
// every re-exported module, exposing it here would drag pdf.js into the server
// bundle of any file that imports anything from `@/features/spaces` (e.g.
// LinkChip). Consumers must use `PdfViewerWrapper`, which loads it via
// `next/dynamic({ ssr: false })` — a lazy import that never evaluates on the
// server.
export { PdfViewerWrapper } from "./components/PdfViewerWrapper";
export { VideoEmbed, detectVideo } from "./components/VideoEmbed";
export { IframeLoader } from "./components/IframeLoader";
export { ViewTracker } from "./components/ViewTracker";
export { SpaceViewer } from "./components/SpaceViewer";
export { HashtagPicker } from "./components/HashtagPicker";
export { PreviewCropper } from "./components/PreviewCropper";
export { MetadataOnlyEditor } from "./components/builders/MetadataOnlyEditor";
export {
  BUILDER_REGISTRY,
  type CreatableContentTypeId,
  type BuilderFieldsProps,
} from "./components/builders/registry";

// ── Editor / builder actions (4b) ───────────────────────────────────────────
export { publishSpace } from "./actions/publish-space";
export type {
  PublishSpacePayload,
  PublishSpaceError,
} from "./actions/publish-space";
export { updateSpace } from "./actions/update-space";
export type { UpdateSpaceResult } from "./actions/update-space";
export { resolveAiEditJob } from "./actions/resolve-ai-edit-job";
export type { ResolveAiEditJobResult } from "./actions/resolve-ai-edit-job";
export { loadHashtagSuggestions } from "./actions/load-hashtag-suggestions";
