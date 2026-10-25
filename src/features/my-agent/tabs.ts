// URL segment ↔ My Agent tab. The activity feed lives at the base path
// (`/dashboard/my-agent`) and at `/dashboard/my-agent/activity`. Shared by the
// server page (validating the segment) and the workspace (pushing the path), the
// same way `features/booking/widgetTabs.ts` does it.
export const MY_AGENT_TABS = [
  "activity",
  "conversations",
  "workflows",
  "knowledge",
  "usage",
  "settings",
] as const;

export type MyAgentTab = (typeof MY_AGENT_TABS)[number];

export function myAgentTabFromSegment(segment: string | undefined): MyAgentTab | null {
  if (!segment) return "activity";
  return (MY_AGENT_TABS as readonly string[]).includes(segment) ? (segment as MyAgentTab) : null;
}
