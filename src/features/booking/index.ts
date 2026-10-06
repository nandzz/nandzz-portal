// Client-safe public API for the booking / widgets feature.
//
// Anything that transitively pulls `import "server-only"` (the `data/` read
// layer) lives in `server.ts`, not here, so this barrel stays importable from
// Client Components. Shared, I/O-free calendar/domain helpers live in
// `@/features/booking/domain/*` (imported by path, not via this barrel) since
// the public HTTP routes depend on them too.

// ── Profile embed + dashboard surfaces ──────────────────────────────────────────────────────
export { CalendarWidgetEmbed } from "./components/calendar/CalendarWidgetEmbed";
export { WidgetWorkspace } from "./components/calendar/WidgetWorkspace";
export { WidgetInstanceSettings } from "./components/calendar/WidgetInstanceSettings";
export { BookingActivationBanner } from "./components/calendar/BookingActivationBanner";
export { AgentWidgetWorkspace } from "./components/agent/AgentWidgetWorkspace";

// ── Public booking surfaces ─────────────────────────────────────────────────
export { CalendarBookingFlow } from "./components/calendar/CalendarBookingFlow";
export { ManageBooking } from "./components/calendar/ManageBooking";
export type { ManageBookingData } from "./components/calendar/ManageBooking";

// ── Icon helper (catalog `icon` string → lucide element) ────────────────────
export {
  renderWidgetIcon,
  resolveWidgetIcon,
  FALLBACK_WIDGET_ICON,
} from "./components/widgetIcon";

// ── Actions (internal dashboard mutations, folded from the instances routes) ─
export { createWidgetInstance } from "./actions/create-widget-instance";
export type { CreateWidgetInstanceResult } from "./actions/create-widget-instance";
export { updateWidgetInstance } from "./actions/update-widget-instance";
export type { UpdateWidgetInstanceResult } from "./actions/update-widget-instance";
