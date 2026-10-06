// Client-safe public API for the agent feature.
//
// Anything that transitively pulls `import "server-only"` (the `data/` read
// layer) lives in `server.ts`, not here, so this barrel stays importable from
// Client Components. The chat / setup-chat LLM streaming endpoints stay as
// `/api/agent/*` routes — streaming responses can't be Server Actions. The
// I/O-free `AGENT_TEMPLATES` domain data stays in `@/lib/agent/templates`.

// ── Components ───────────────────────────────────────────────────────────────
export { AgentChat } from "./components/AgentChat";
export { AgentChatOverlay } from "./components/AgentChatOverlay";
export { AgentWidgetCard } from "./components/AgentWidgetCard";
export { AgentPublic } from "./components/AgentPublic";
export { AgentStudio } from "./components/AgentStudio";
export { AgentSettings } from "./components/AgentSettings";
export { SetupAssistant } from "./components/SetupAssistant";

// ── Actions (internal dashboard mutations + client-mount reads) ──────────────
export { loadAgentDocuments } from "./actions/load-agent-documents";
export type { LoadAgentDocumentsResult } from "./actions/load-agent-documents";
export { createAgentDocument } from "./actions/create-agent-document";
export type { CreateAgentDocumentResult } from "./actions/create-agent-document";
export { updateAgentDocument } from "./actions/update-agent-document";
export type { UpdateAgentDocumentResult } from "./actions/update-agent-document";
export { deleteAgentDocument } from "./actions/delete-agent-document";
export type { DeleteAgentDocumentResult } from "./actions/delete-agent-document";
export { embedAgentDocument } from "./actions/embed-agent-document";
export type { EmbedAgentDocumentResult } from "./actions/embed-agent-document";
export { saveAgentSettings } from "./actions/save-agent-settings";
export type { SaveAgentSettingsResult } from "./actions/save-agent-settings";
