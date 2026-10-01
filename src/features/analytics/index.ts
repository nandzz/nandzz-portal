// Client-safe public API for the analytics + layout-chrome feature (the final
// migration). Anything that transitively pulls `import "server-only"` (the
// `data/` read layer) lives in `server.ts`, not here, so this barrel stays
// importable from Client Components.
//
// The chrome's browser-only concerns live OUTSIDE `components/` to satisfy the
// `no-restricted-imports` guardrail: `auth.ts` (Supabase Auth session + the
// reactive profile read) and `realtime.ts` (notification / AI-job subscriptions
// + their paired mount reads). The components consume those via relative
// imports; external consumers only need the barrels below.

// ── Layout chrome ────────────────────────────────────────────────────────────
export { Navbar } from "./components/Navbar";
export { Sidebar } from "./components/Sidebar";
export { MobileTabBar } from "./components/MobileTabBar";
export { ProfileVisitorCta } from "./components/ProfileVisitorCta";
export { NotificationBell } from "./components/NotificationBell";
export { AiJobsIndicator } from "./components/AiJobsIndicator";

// ── Analytics surfaces ───────────────────────────────────────────────────────
export { ViewsChart } from "./components/ViewsChart";
export { AnalyticsPeriodControl } from "./components/AnalyticsPeriodControl";

// ── Actions (view tracking + chrome mutations) ───────────────────────────────
export { recordSpaceView } from "./actions/record-view";
export type { RecordViewResult } from "./actions/record-view";
export { markNotificationsRead } from "./actions/mark-notifications-read";
export type { MarkNotificationsReadResult } from "./actions/mark-notifications-read";
export { deleteAiJob } from "./actions/delete-ai-job";
export type { DeleteAiJobResult } from "./actions/delete-ai-job";
