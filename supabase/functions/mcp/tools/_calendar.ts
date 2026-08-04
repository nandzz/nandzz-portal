// Shared calendar helpers for the MCP booking tools. The MCP server runs in the
// owner's context (ctx.userId = the connected account), so these resolve the
// owner's own calendar widget instance.
//
// This is a Deno-side copy of the slot math in src/lib/widgets/calendar.ts (the
// Next app can't be imported here). Keep the two in sync when the algorithm
// changes.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type CalService = { id: string; name: string; duration_min: number; price_cents?: number | null };
export type CalConfig = {
  timezone: string;
  buffer_min: number;
  services: CalService[];
  availability: Record<string, [string, string][]>;
  blackout_dates: string[];
};

export type CalendarInstance = { id: string; config: CalConfig };

export async function resolveOwnerCalendar(
  admin: SupabaseClient,
  userId: string,
): Promise<CalendarInstance | null> {
  const { data: rows } = await admin
    .from("widget_instances")
    .select("id, config, enabled, catalog:widget_catalog(slug)")
    .eq("user_id", userId)
    .eq("enabled", true);

  const cal = (rows ?? []).find((r: { catalog?: { slug?: string } | { slug?: string }[] }) => {
    const cat = Array.isArray(r.catalog) ? r.catalog[0] : r.catalog;
    return cat?.slug === "calendar";
  });
  if (!cal) return null;

  const raw = (cal.config ?? {}) as Partial<CalConfig>;
  const config: CalConfig = {
    timezone: raw.timezone || "UTC",
    buffer_min: Number(raw.buffer_min ?? 0),
    services: Array.isArray(raw.services) ? raw.services : [],
    availability: (raw.availability ?? {}) as CalConfig["availability"],
    blackout_dates: Array.isArray(raw.blackout_dates) ? raw.blackout_dates : [],
  };
  return { id: cal.id as string, config };
}

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function weekdayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return WEEKDAYS[(dow + 6) % 7];
}

function zonedWallTimeToUtc(dateStr: string, hhmm: string, tz: string): Date {
  const asUtc = new Date(`${dateStr}T${hhmm}:00Z`);
  const tzView = new Date(asUtc.toLocaleString("en-US", { timeZone: tz }));
  const utcView = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(asUtc.getTime() + (utcView.getTime() - tzView.getTime()));
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}

export function todayInZone(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function computeSlots(
  config: CalConfig,
  service: CalService,
  fromDate: string,
  days: number,
  existing: { starts_at: string; ends_at: string }[],
  now = new Date(),
): { start: string; end: string }[] {
  const buffer = Math.max(0, config.buffer_min || 0);
  const step = service.duration_min + buffer;
  const earliest = now.getTime() + 60 * 60_000;
  const busy = existing.map((b) => ({ start: new Date(b.starts_at).getTime(), end: new Date(b.ends_at).getTime() }));
  const slots: { start: string; end: string }[] = [];

  for (let i = 0; i < days; i++) {
    const dateStr = addDays(fromDate, i);
    if (config.blackout_dates.includes(dateStr)) continue;
    const windows = config.availability[weekdayOf(dateStr)] ?? [];
    for (const [ws, we] of windows) {
      const wsMin = minutesOf(ws);
      const weMin = minutesOf(we);
      for (let m = wsMin; m + service.duration_min <= weMin; m += step) {
        const hh = String(Math.floor(m / 60)).padStart(2, "0");
        const mm = String(m % 60).padStart(2, "0");
        const startMs = zonedWallTimeToUtc(dateStr, `${hh}:${mm}`, config.timezone).getTime();
        const endMs = startMs + service.duration_min * 60_000;
        if (startMs < earliest) continue;
        const pad = buffer * 60_000;
        if (busy.some((b) => startMs < b.end + pad && endMs + pad > b.start)) continue;
        slots.push({ start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() });
      }
    }
  }
  return slots;
}
