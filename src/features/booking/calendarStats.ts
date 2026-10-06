import type { CalendarConfig, CalendarService, WidgetBooking } from "@/lib/types";
import type { WidgetOverviewData } from "@/features/booking/components/calendar/WidgetOverview";
import { buildPeriodBuckets, type StatsPeriod } from "@/lib/period";
import {
  addDays,
  eligibleStaffForService,
  getLocationScope,
  todayInZone,
  weekdayOf,
  zonedWallTimeToUtc,
  type LocationScope,
} from "@/features/booking/domain/calendar";

// Overview aggregation for the widget dashboard. A pure function over a bounded
// window of bookings so it can run server-side (the /dashboard route + loader,
// via features/booking/dashboardData) with no per-row payload crossing the wire.
// The Bookings and Customers tabs no longer aggregate in the client — they read
// windowed rows / the widget_customers_summary RPC respectively.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_MS = 60_000;
const CAPACITY_DAYS = 7;

// The booking columns the overview reads (see fetchOverviewData).
export type OverviewBookingRow = Pick<
  WidgetBooking,
  "id" | "status" | "starts_at" | "ends_at" | "price_cents" | "service_name" | "service_id" | "duration_min" | "staff_id" | "services"
>;

// A per-staff busy slice from widget_booking_segments. Only needed for staffed
// scopes — it carries the real per-service staff/sub-window of multi-service
// bookings (a booking row only holds the primary staff + overall span).
export type OverviewSegment = {
  booking_id: string;
  staff_id: string | null;
  starts_at: string;
  ends_at: string;
};

export type OverviewContext = {
  config: CalendarConfig;
  locationId: string | null;
  segments?: OverviewSegment[];
  now?: Date;
};

// ── Interval math (epoch-ms half-open ranges) ────────────────────────────────
type Range = [number, number];

function merge(ranges: Range[]): Range[] {
  const sorted = ranges.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const out: Range[] = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

function intersect(a: Range[], b: Range[]): Range[] {
  const out: Range[] = [];
  for (const [as, ae] of merge(a)) {
    for (const [bs, be] of merge(b)) {
      const s = Math.max(as, bs);
      const e = Math.min(ae, be);
      if (e > s) out.push([s, e]);
    }
  }
  return merge(out);
}

function subtract(a: Range[], b: Range[]): Range[] {
  let out = merge(a);
  for (const [bs, be] of merge(b)) {
    const next: Range[] = [];
    for (const [s, e] of out) {
      if (be <= s || bs >= e) next.push([s, e]);
      else {
        if (bs > s) next.push([s, bs]);
        if (be < e) next.push([be, e]);
      }
    }
    out = next;
  }
  return out;
}

function clipFrom(ranges: Range[], fromMs: number): Range[] {
  return ranges.map(([s, e]): Range => [Math.max(s, fromMs), e]).filter(([s, e]) => e > s);
}

function minutes(ranges: Range[]): number {
  return Math.round(merge(ranges).reduce((sum, [s, e]) => sum + (e - s), 0) / MIN_MS);
}

// ── Service split ────────────────────────────────────────────────────────────
// One line per booked service: multi-service bookings expand into their
// `services` snapshot so each service gets its own count and revenue; single
// bookings (services null) are described by the aggregate columns.
export function bookingServiceLines(
  b: Pick<WidgetBooking, "service_id" | "service_name" | "price_cents" | "services">
): { id: string | null; name: string; priceCents: number }[] {
  if (Array.isArray(b.services) && b.services.length > 0) {
    return b.services.map((s) => ({ id: s.service_id ?? null, name: s.name, priceCents: s.price_cents ?? 0 }));
  }
  return [{ id: b.service_id ?? null, name: b.service_name, priceCents: b.price_cents ?? 0 }];
}

// The service capacity is measured in: the most-booked (by split count) service
// that's still offered in this scope, else the first offered service.
export function pickReferenceService(
  bookings: Pick<WidgetBooking, "service_id" | "service_name" | "price_cents" | "services">[],
  scopeServices: CalendarService[]
): CalendarService | null {
  const valid = scopeServices.filter((s) => s.duration_min > 0);
  if (valid.length === 0) return null;
  const counts = new Map<string, number>();
  for (const b of bookings) {
    for (const line of bookingServiceLines(b)) {
      if (line.id) counts.set(line.id, (counts.get(line.id) ?? 0) + 1);
    }
  }
  let best: CalendarService | null = null;
  let bestCount = 0;
  for (const s of valid) {
    const c = counts.get(s.id) ?? 0;
    if (c > bestCount) {
      best = s;
      bestCount = c;
    }
  }
  return best ?? valid[0];
}

// ── Capacity model ───────────────────────────────────────────────────────────
// Mirrors computeAvailableSlots: a business blackout closes the day; without
// staff the business is one resource open during its windows; with staff each
// member is a resource open during (their windows ∩ business windows), minus
// their personal days off.
type Busy = { staffId: string | null; start: number; end: number };

type ScheduleCtx = {
  scope: LocationScope;
  timezone: string;
  bufferMin: number;
  busy: Busy[];
};

type DayResult = {
  openMin: number;
  bookedMin: number;
  // Free open minutes from `fromMs` on (forecast potential).
  freeMinAfter: number;
  // How many `service` fit into the free gaps from `fromMs` on.
  fits: number;
};

function windowsFor(
  dateStr: string,
  windows: [string, string][] | undefined,
  timezone: string
): Range[] {
  return merge(
    (windows ?? []).map(([s, e]): Range => [
      zonedWallTimeToUtc(dateStr, s, timezone).getTime(),
      zonedWallTimeToUtc(dateStr, e, timezone).getTime(),
    ])
  );
}

function countFits(gaps: Range[], durationMin: number, bufferMin: number): number {
  const step = durationMin + bufferMin;
  if (durationMin <= 0) return 0;
  return gaps.reduce((n, [s, e]) => n + Math.max(0, Math.floor(((e - s) / MIN_MS + bufferMin) / step)), 0);
}

function dayCapacity(
  dateStr: string,
  ctx: ScheduleCtx,
  service: CalendarService | null,
  fromMs: number
): DayResult {
  const empty = { openMin: 0, bookedMin: 0, freeMinAfter: 0, fits: 0 };
  const { scope, timezone, bufferMin } = ctx;
  if (scope.blackout_dates.includes(dateStr)) return empty;
  const weekday = weekdayOf(dateStr);
  const business = windowsFor(dateStr, scope.availability[weekday], timezone);
  if (business.length === 0) return empty;

  const pad = bufferMin * MIN_MS;
  // Only bookings touching today's opening span matter (keeps each day cheap).
  const lo = business[0][0] - pad;
  const hi = business[business.length - 1][1] + pad;
  const busy = ctx.busy.filter((b) => b.end > lo && b.start < hi);
  const toRanges = (list: Busy[]): Range[] => list.map((b): Range => [b.start, b.end]);
  const padded = (list: Busy[]): Range[] => list.map((b): Range => [b.start - pad, b.end + pad]);

  // Resources for the day: the business itself, or each working staff member.
  const staffMode = scope.staff.length > 0;
  const resources: { id: string | null; open: Range[] }[] = staffMode
    ? scope.staff
        .filter((st) => !st.blackout_dates?.includes(dateStr))
        .map((st) => ({ id: st.id, open: intersect(windowsFor(dateStr, st.availability[weekday], timezone), business) }))
    : [{ id: null, open: business }];

  const eligible = service
    ? new Set(staffMode ? eligibleStaffForService(scope.staff, service).map((s) => s.id) : [null])
    : new Set<string | null>();

  let openMin = 0;
  let bookedMin = 0;
  let freeMinAfter = 0;
  let fits = 0;
  for (const r of resources) {
    const own = staffMode ? busy.filter((b) => b.staffId === r.id) : busy;
    const ownRanges = toRanges(own);
    openMin += minutes(r.open);
    bookedMin += minutes(intersect(ownRanges, r.open));
    const openAfter = clipFrom(r.open, fromMs);
    freeMinAfter += minutes(subtract(openAfter, ownRanges));
    if (service && eligible.has(r.id)) {
      // Padding each booking by the buffer on both sides and then applying
      // floor((gap + buffer) / (duration + buffer)) to the leftover gaps gives
      // the exact count of buffer-separated appointments that fit.
      fits += countFits(subtract(openAfter, padded(own)), service.duration_min, bufferMin);
    }
  }

  // Staffed but unassigned bookings (no staff_id, or a since-removed staff
  // member) still occupy time — counted once against the business hours.
  if (staffMode) {
    const known = new Set(scope.staff.map((s) => s.id));
    const unassigned = toRanges(busy.filter((b) => b.staffId === null || !known.has(b.staffId)));
    if (unassigned.length > 0) {
      bookedMin += minutes(intersect(unassigned, business));
      freeMinAfter = Math.max(0, freeMinAfter - minutes(intersect(unassigned, clipFrom(business, fromMs))));
    }
  }

  return { openMin, bookedMin: Math.min(bookedMin, openMin), freeMinAfter, fits };
}

// Busy ranges for confirmed bookings: per-staff segments when the scope is
// staffed and the booking has them, else the booking row's own span/staff.
function buildBusy(confirmed: OverviewBookingRow[], segments: OverviewSegment[], staffMode: boolean): Busy[] {
  const byBooking = new Map<string, OverviewSegment[]>();
  if (staffMode) {
    for (const s of segments) {
      const list = byBooking.get(s.booking_id);
      if (list) list.push(s);
      else byBooking.set(s.booking_id, [s]);
    }
  }
  const out: Busy[] = [];
  for (const b of confirmed) {
    const segs = byBooking.get(b.id);
    if (segs) {
      for (const s of segs) {
        out.push({ staffId: s.staff_id, start: Date.parse(s.starts_at), end: Date.parse(s.ends_at) });
      }
    } else if (b.ends_at) {
      out.push({ staffId: staffMode ? b.staff_id : null, start: Date.parse(b.starts_at), end: Date.parse(b.ends_at) });
    }
  }
  return out;
}

function formatDayLabel(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function bookedMinutesOf(b: OverviewBookingRow): number {
  if (typeof b.duration_min === "number" && b.duration_min > 0) return b.duration_min;
  if (!b.ends_at) return 0;
  return Math.max(0, Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / MIN_MS));
}

// Next 7 days (today first, owner tz): open vs. booked minutes + how many more
// of the reference service fit. Today's `fits` only counts time after `now`.
export function buildCapacity(
  confirmed: OverviewBookingRow[],
  ctx: { config: CalendarConfig; locationId: string | null; timezone: string; segments: OverviewSegment[]; locale: string; now: Date },
  referenceService: CalendarService | null
): WidgetOverviewData["capacity"] {
  const scope = getLocationScope(ctx.config, ctx.locationId);
  const schedule: ScheduleCtx = {
    scope,
    timezone: ctx.timezone,
    bufferMin: Math.max(0, ctx.config.buffer_min || 0),
    busy: buildBusy(confirmed, ctx.segments, scope.staff.length > 0),
  };
  const today = todayInZone(ctx.timezone, ctx.now);
  const nowMs = ctx.now.getTime();
  const days = Array.from({ length: CAPACITY_DAYS }, (_, i) => {
    const date = addDays(today, i);
    const r = dayCapacity(date, schedule, referenceService, nowMs);
    return {
      date,
      label: formatDayLabel(date, ctx.locale),
      openMin: r.openMin,
      bookedMin: r.bookedMin,
      fits: r.fits,
      closed: r.openMin === 0,
    };
  });
  return {
    referenceService: referenceService
      ? { name: referenceService.name, durationMin: referenceService.duration_min }
      : null,
    days,
  };
}

// Current calendar month (owner tz): realized vs. still-booked revenue, plus
// what the remaining free capacity would be worth at the historical average
// value per booked minute (staff-minutes, same model as buildCapacity).
export function buildForecast(
  confirmed: OverviewBookingRow[],
  ctx: { config: CalendarConfig; locationId: string | null; timezone: string; segments: OverviewSegment[]; locale: string; now: Date }
): WidgetOverviewData["forecast"] {
  const { timezone, now } = ctx;
  const nowMs = now.getTime();
  const today = todayInZone(timezone, now);
  const [y, m] = today.split("-").map(Number);
  const monthKey = today.slice(0, 7);
  const nextMonth = new Date(Date.UTC(y, m, 1, 12)).toISOString().slice(0, 10);
  const monthStart = zonedWallTimeToUtc(`${monthKey}-01`, "00:00", timezone).getTime();
  const monthEnd = zonedWallTimeToUtc(nextMonth, "00:00", timezone).getTime();

  let earnedCents = 0;
  let bookedCents = 0;
  let pricedCents = 0;
  let pricedCount = 0;
  let pricedMin = 0;
  for (const b of confirmed) {
    const t = Date.parse(b.starts_at);
    const price = b.price_cents ?? 0;
    if (t >= monthStart && t < monthEnd) {
      if (t < nowMs) earnedCents += price;
      else bookedCents += price;
    }
    if (price > 0) {
      pricedCents += price;
      pricedCount += 1;
      pricedMin += bookedMinutesOf(b);
    }
  }

  const scope = getLocationScope(ctx.config, ctx.locationId);
  const schedule: ScheduleCtx = {
    scope,
    timezone,
    bufferMin: Math.max(0, ctx.config.buffer_min || 0),
    busy: buildBusy(confirmed, ctx.segments, scope.staff.length > 0),
  };
  let freeMin = 0;
  for (let date = today; date < nextMonth; date = addDays(date, 1)) {
    freeMin += dayCapacity(date, schedule, null, nowMs).freeMinAfter;
  }
  const centsPerMin = pricedMin > 0 ? pricedCents / pricedMin : 0;

  return {
    monthLabel: new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(ctx.locale, { month: "long", timeZone: "UTC" }),
    earnedCents,
    bookedCents,
    potentialCents: Math.round(freeMin * centsPerMin),
    avgTicketCents: pricedCount > 0 ? Math.round(pricedCents / pricedCount) : 0,
  };
}

export function buildOverview(
  bookings: OverviewBookingRow[],
  timezone: string,
  currencySymbol: string,
  shareUrl: string | null,
  locale: string,
  period: StatsPeriod,
  ctx: OverviewContext
): WidgetOverviewData {
  const nowDate = ctx.now ?? new Date();
  const now = nowDate.getTime();
  const confirmed = bookings.filter((b) => b.status === "confirmed");

  // "Next 7 days" is a fixed live window by definition (it says so on the
  // tile) — it stays put regardless of which period is selected.
  const in7 = now + WEEK_MS;
  const next7 = confirmed.filter((b) => {
    const t = new Date(b.starts_at).getTime();
    return t >= now && t < in7;
  }).length;

  // Booking volume trend, bucketed by the selected period (day/week/month
  // granularity), with one extra bucket ahead since bookings can be forward-dated.
  const buckets = buildPeriodBuckets(period, locale, { includeFuture: true });
  const rangeStart = buckets[0].start;
  const rangeEnd = buckets[buckets.length - 1].end;
  const trend = buckets.map((bucket) => {
    const count = confirmed.filter((b) => {
      const t = new Date(b.starts_at).getTime();
      return t >= bucket.start && t < bucket.end;
    }).length;
    return { label: bucket.label, count, isFuture: bucket.isFuture };
  });

  // Everything below shares the trend chart's start–end window, so the KPI
  // tiles and service breakdown move together with the period selector.
  const inRange = confirmed.filter((b) => {
    const t = new Date(b.starts_at).getTime();
    return t >= rangeStart && t < rangeEnd;
  });
  const upcomingCount = inRange.filter((b) => new Date(b.starts_at).getTime() >= now).length;
  const revenueCents = inRange.reduce((sum, b) => sum + (b.price_cents ?? 0), 0);
  const cancelled = bookings.filter((b) => {
    if (b.status !== "cancelled") return false;
    const t = new Date(b.starts_at).getTime();
    return t >= rangeStart && t < rangeEnd;
  }).length;

  // Bookings by service — multi-service bookings split into their lines.
  const byService = new Map<string, { count: number; revenueCents: number }>();
  for (const b of inRange) {
    for (const line of bookingServiceLines(b)) {
      const cur = byService.get(line.name) ?? { count: 0, revenueCents: 0 };
      cur.count += 1;
      cur.revenueCents += line.priceCents;
      byService.set(line.name, cur);
    }
  }
  const services = [...byService.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count);

  // Capacity + forecast read the live schedule, independent of the period.
  // The reference service is ranked over the whole fetched window so it stays
  // stable while the owner flips the period selector.
  const scope = getLocationScope(ctx.config, ctx.locationId);
  const scheduleCtx = {
    config: ctx.config,
    locationId: ctx.locationId,
    timezone,
    segments: ctx.segments ?? [],
    locale,
    now: nowDate,
  };
  const capacity = buildCapacity(confirmed, scheduleCtx, pickReferenceService(confirmed, scope.services));
  const forecast = buildForecast(confirmed, scheduleCtx);

  return {
    timezone,
    currencySymbol,
    totals: {
      upcoming: upcomingCount,
      confirmedInPeriod: inRange.length,
      revenueCents,
      next7,
      cancelled,
    },
    trend,
    services,
    capacity,
    forecast,
    shareUrl,
  };
}
