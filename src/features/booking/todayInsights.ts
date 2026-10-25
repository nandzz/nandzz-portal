import type { WidgetBooking } from "@/lib/types";
import type { TodayCustomerInsight } from "@/features/booking/dashboardTypes";

// Pure history → insight rollup for the Today tab's customer panel. Kept out
// of the server-only data layer so it can be unit-tested directly.

const DAY_MS = 24 * 60 * 60 * 1000;

// The booking columns a customer's history is read with (see fetchTodayData).
export const HISTORY_COLUMNS = "id, starts_at, status, service_id, service_name, services, staff_name, price_cents, notes";

export type HistoryRow = Pick<
  WidgetBooking,
  "id" | "starts_at" | "status" | "service_id" | "service_name" | "services" | "staff_name" | "price_cents" | "notes"
>;

const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

// Rows arrive newest-first. "Visits" are confirmed bookings that started
// before today; preferences only surface once a pattern is actually repeated.
export function buildCustomerInsight(
  rows: HistoryRow[],
  opts: { dayStart: string; dayEnd: string; timezone: string }
): TodayCustomerInsight {
  const { timezone } = opts;
  // Compare as epoch ms: Postgres returns "+00:00" offsets while the bounds are
  // "…Z" strings, so string comparison would misplace boundary rows.
  const dayStart = Date.parse(opts.dayStart);
  const dayEnd = Date.parse(opts.dayEnd);
  const at = (r: HistoryRow) => Date.parse(r.starts_at);
  const confirmed = rows.filter((r) => r.status === "confirmed");
  const past = confirmed.filter((r) => at(r) < dayStart);
  const future = confirmed.filter((r) => at(r) >= dayEnd);

  const lines = (r: HistoryRow) =>
    Array.isArray(r.services) && r.services.length > 0
      ? r.services.map((s) => ({ name: s.name, staff: s.staff_name ?? r.staff_name ?? null }))
      : [{ name: r.service_name, staff: r.staff_name ?? null }];

  const serviceCounts = new Map<string, number>();
  const staffCounts = new Map<string, number>();
  let staffed = 0;
  for (const r of confirmed) {
    const ls = lines(r);
    for (const l of ls) serviceCounts.set(l.name, (serviceCounts.get(l.name) ?? 0) + 1);
    const names = new Set(ls.map((l) => l.staff).filter((n): n is string => Boolean(n)));
    if (names.size > 0) staffed += 1;
    for (const n of names) staffCounts.set(n, (staffCounts.get(n) ?? 0) + 1);
  }
  const topServices = [...serviceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));
  const [bestStaff] = [...staffCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topStaff = bestStaff && bestStaff[1] >= 2 ? { name: bestStaff[0], count: bestStaff[1], of: staffed } : null;

  // Habits, read in the location's timezone across confirmed visits.
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "numeric", hourCycle: "h23" });
  const dayparts = new Map<TodayCustomerInsight["usualDaypart"], number>();
  const weekdays = new Map<number, number>();
  for (const r of confirmed) {
    const p = parts.formatToParts(new Date(r.starts_at));
    const hour = Number(p.find((x) => x.type === "hour")?.value ?? 0);
    const dp = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    dayparts.set(dp, (dayparts.get(dp) ?? 0) + 1);
    const wd = WEEKDAY_INDEX[p.find((x) => x.type === "weekday")?.value ?? ""];
    if (wd !== undefined) weekdays.set(wd, (weekdays.get(wd) ?? 0) + 1);
  }
  const [bestDaypart] = [...dayparts.entries()].sort((a, b) => b[1] - a[1]);
  const [bestWeekday] = [...weekdays.entries()].sort((a, b) => b[1] - a[1]);
  const n = confirmed.length;
  const usualDaypart = n >= 2 && bestDaypart && bestDaypart[1] / n >= 0.6 ? bestDaypart[0] : null;
  const usualWeekday = n >= 3 && bestWeekday && bestWeekday[1] / n >= 0.5 ? bestWeekday[0] : null;

  let avgGapDays: number | null = null;
  if (past.length >= 2) {
    const span = Date.parse(past[0].starts_at) - Date.parse(past[past.length - 1].starts_at);
    avgGapDays = Math.round(span / DAY_MS / (past.length - 1));
  }

  return {
    pastVisits: past.length,
    spentCents: past.reduce((sum, r) => sum + (r.price_cents ?? 0), 0),
    cancelled: rows.filter((r) => r.status === "cancelled").length,
    firstVisit: past[past.length - 1]?.starts_at ?? null,
    lastVisit: past[0]?.starts_at ?? null,
    nextVisit: future[future.length - 1]?.starts_at ?? null,
    avgGapDays,
    topServices,
    topStaff,
    usualDaypart,
    usualWeekday,
    notes: rows
      .filter((r) => at(r) < dayStart && r.notes && r.notes.trim())
      .slice(0, 3)
      .map((r) => ({ date: r.starts_at, text: r.notes!.trim() })),
    recent: past.slice(0, 3).map((r) => ({
      id: r.id,
      starts_at: r.starts_at,
      services: lines(r)
        .map((l) => l.name)
        .join(", "),
      price_cents: r.price_cents,
    })),
  };
}
