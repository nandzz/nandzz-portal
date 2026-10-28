// Step → dashboard tab (and the real URL segment shown in the frame).
export type DashboardTab = "today" | "overview" | "bookings" | "customers";

export const STEPS: { tab: DashboardTab; segment: string }[] = [
  { tab: "today", segment: "today" },
  { tab: "today", segment: "today" },
  { tab: "overview", segment: "dashboard" },
  { tab: "overview", segment: "dashboard" },
  { tab: "bookings", segment: "bookings" },
  { tab: "customers", segment: "customers" },
];

export const stepTab = (step: number): DashboardTab => (STEPS[step] ?? STEPS[0]).tab;
