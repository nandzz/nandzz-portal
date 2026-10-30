// Shared calendar helpers for the MCP booking tools. The MCP server runs in the
// owner's context (ctx.userId = the connected account), so these resolve the
// owner's own calendar widget instance.
//
// This is a Deno-side copy of the single-service slot math in
// src/features/booking/domain/calendar.ts (computeSegmentedSlots with one
// service) — the Next app can't be imported here. Keep the two in sync when the
// algorithm changes.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type Windows = Record<string, [string, string][]>;

export type CalService = {
  id: string;
  name: string;
  duration_min: number;
  price_cents?: number | null;
  staff_ids?: string[];
};

export type CalStaff = { id: string; availability: Windows; blackout_dates?: string[] };

// One bookable subtree: a location's own services/staff/hours, or — for a
// config without locations — the top level. `locationId` null ⇒ top level.
export type CalScope = {
  locationId: string | null;
  locationName: string | null;
  timezone: string;
  services: CalService[];
  staff: CalStaff[];
  availability: Windows;
  blackout_dates: string[];
};

export type CalConfig = { timezone: string; buffer_min: number; scopes: CalScope[] };

export type CalendarInstance = { id: string; config: CalConfig };

type RawScope = {
  services?: unknown;
  staff?: unknown;
  availability?: unknown;
  blackout_dates?: unknown;
};

function toScope(raw: RawScope, locationId: string | null, locationName: string | null, timezone: string): CalScope {
  const staff = (Array.isArray(raw.staff) ? raw.staff : [])
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && typeof s.id === "string" && !!s.id)
    .map((s) => ({
      id: s.id as string,
      availability: (s.availability && typeof s.availability === "object" ? s.availability : {}) as Windows,
      blackout_dates: Array.isArray(s.blackout_dates) ? (s.blackout_dates as string[]) : undefined,
    }));
  return {
    locationId,
    locationName,
    timezone,
    services: Array.isArray(raw.services) ? (raw.services as CalService[]) : [],
    staff,
    availability: (raw.availability && typeof raw.availability === "object" ? raw.availability : {}) as Windows,
    blackout_dates: Array.isArray(raw.blackout_dates) ? (raw.blackout_dates as string[]) : [],
  };
}

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

  const raw = (cal.config ?? {}) as RawScope & { timezone?: string; buffer_min?: unknown; locations?: unknown };
  const timezone = raw.timezone || "UTC";
  const locations = (Array.isArray(raw.locations) ? raw.locations : []).filter(
    (l): l is RawScope & { id: string; name?: string; timezone?: string } =>
      !!l && typeof l === "object" && typeof (l as { id?: unknown }).id === "string",
  );
  // Same rule as the public booking flow: once a business has locations, only
  // the locations are bookable; the top level is the legacy single-site shape.
  const scopes = locations.length > 0
    ? locations.map((l) => toScope(l, l.id, l.name ?? null, l.timezone || timezone))
    : [toScope(raw, null, null, timezone)];
  return { id: cal.id as string, config: { timezone, buffer_min: Number(raw.buffer_min ?? 0), scopes } };
}

export type ServiceMatch = { scope: CalScope; service: CalService };

// Find a service by id, optionally within one location. Returns every match so
// the caller can ask for a location_id when the id is offered at several.
export function findService(config: CalConfig, serviceId: string, locationId?: string | null): ServiceMatch[] {
  return config.scopes
    .filter((sc) => !locationId || sc.locationId === locationId)
    .flatMap((sc) => sc.services.filter((s) => s.id === serviceId).map((service) => ({ scope: sc, service })));
}

// "Haircut (id: svc_1, location_id: loc_main)" for every bookable service.
export function describeServices(config: CalConfig): string {
  return config.scopes
    .flatMap((sc) =>
      sc.services.map((s) =>
        sc.locationId
          ? `${s.name} (id: ${s.id}, location_id: ${sc.locationId}${sc.locationName ? ` "${sc.locationName}"` : ""})`
          : `${s.name} (id: ${s.id})`
      )
    )
    .join(", ");
}

// Resolve `service_id` (+ optional `location_id`) to one service, or an error
// message listing what the caller can use instead.
export function pickService(
  config: CalConfig,
  serviceId: string,
  locationId?: string | null,
): { ok: true; match: ServiceMatch } | { ok: false; message: string } {
  const matches = findService(config, serviceId, locationId);
  if (matches.length === 1) return { ok: true, match: matches[0] };
  if (matches.length > 1) {
    const ids = matches.map((m) => m.scope.locationId).join(", ");
    return { ok: false, message: `That service is offered at several locations. Pass location_id (one of: ${ids}).` };
  }
  const list = describeServices(config);
  return { ok: false, message: `Unknown service_id. Available services: ${list || "none configured"}.` };
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

export function addDays(dateStr: string, n: number): string {
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

// A confirmed booking segment (widget_booking_segments). `staff_id` null ⇒ the
// single-resource bucket.
export type BusySegment = { staff_id: string | null; starts_at: string; ends_at: string };

// Open start times for one service in one scope. With no staff the scope is a
// single resource; with staff, a slot is open when an eligible staff member
// works the whole slot, isn't on a day off, and has no clashing segment.
export function computeSlots(
  scope: CalScope,
  bufferMin: number,
  service: CalService,
  fromDate: string,
  days: number,
  existing: BusySegment[],
  now = new Date(),
): { start: string; end: string }[] {
  const buffer = Math.max(0, bufferMin || 0);
  const step = service.duration_min + buffer;
  const pad = buffer * 60_000;
  const earliest = now.getTime() + 60 * 60_000;
  const busy = existing.map((b) => ({
    staffId: b.staff_id ?? null,
    start: new Date(b.starts_at).getTime(),
    end: new Date(b.ends_at).getTime(),
  }));
  const hasStaff = scope.staff.length > 0;
  const eligible = service.staff_ids && service.staff_ids.length > 0
    ? scope.staff.filter((s) => service.staff_ids!.includes(s.id))
    : scope.staff;
  const slots: { start: string; end: string }[] = [];
  if (!(service.duration_min > 0)) return slots;

  for (let i = 0; i < days; i++) {
    const dateStr = addDays(fromDate, i);
    if (scope.blackout_dates.includes(dateStr)) continue;
    const weekday = weekdayOf(dateStr);
    const windows = scope.availability[weekday] ?? [];
    for (const [ws, we] of windows) {
      const wsMin = minutesOf(ws);
      const weMin = minutesOf(we);
      for (let m = wsMin; m + service.duration_min <= weMin; m += step) {
        const endMin = m + service.duration_min;
        const hh = String(Math.floor(m / 60)).padStart(2, "0");
        const mm = String(m % 60).padStart(2, "0");
        const startMs = zonedWallTimeToUtc(dateStr, `${hh}:${mm}`, scope.timezone).getTime();
        const endMs = startMs + service.duration_min * 60_000;
        if (startMs < earliest) continue;
        const clashes = (staffId: string | null) =>
          busy.some((b) => b.staffId === staffId && startMs < b.end + pad && endMs + pad > b.start);
        const open = hasStaff
          ? eligible.some(
            (st) =>
              !st.blackout_dates?.includes(dateStr) &&
              (st.availability[weekday] ?? []).some(([s, e]) => minutesOf(s) <= m && endMin <= minutesOf(e)) &&
              !clashes(st.id),
          )
          : !clashes(null);
        if (!open) continue;
        slots.push({ start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() });
      }
    }
  }
  return slots;
}
