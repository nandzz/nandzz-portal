// Canonical mapping between a booking workspace URL segment and the internal
// Tabs value. The overview tab lives at the feature's base path
// (`/dashboard/booking`) but is also reachable at `/dashboard/booking/dashboard`,
// so its URL segment is "dashboard" while its Tabs value stays "overview". Every
// other tab maps 1:1.
//
// Shared by the server page (validating the URL segment) and WidgetWorkspace
// (pushing the path as the owner switches tabs) so the two never drift.
export const WIDGET_TABS = [
  { tab: "overview", segment: "dashboard" },
  { tab: "bookings", segment: "bookings" },
  { tab: "customers", segment: "customers" },
  { tab: "staff", segment: "staff" },
  { tab: "availability", segment: "availability" },
  { tab: "services", segment: "services" },
] as const;

export type WidgetTab = (typeof WIDGET_TABS)[number]["tab"];

const SEGMENT_TO_TAB = new Map<string, WidgetTab>(WIDGET_TABS.map((e) => [e.segment, e.tab]));
const TAB_TO_SEGMENT = new Map<string, string>(WIDGET_TABS.map((e) => [e.tab, e.segment]));

// URL segment -> internal tab. An absent segment (the widget's base path)
// resolves to the overview tab; an unrecognized segment returns null so the
// caller can 404.
export function tabFromSegment(segment: string | undefined): WidgetTab | null {
  if (!segment) return "overview";
  return SEGMENT_TO_TAB.get(segment) ?? null;
}

// Internal tab -> URL segment, for building the studio path to push.
export function segmentFromTab(tab: string): string {
  return TAB_TO_SEGMENT.get(tab) ?? "dashboard";
}
