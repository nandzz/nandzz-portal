import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarConfig, WidgetBooking } from "@/lib/types";
import type { BookingRowData, CustomerProfileLink } from "@/features/booking/components/calendar/BookingRow";
import type { WidgetOverviewData } from "@/features/booking/components/calendar/WidgetOverview";
import type { WidgetCustomersData, CustomerSummary } from "@/features/booking/components/calendar/WidgetCustomers";
import {
  buildOverview,
  buildTodaySchedule,
  type OverviewBookingRow,
  type OverviewSegment,
} from "@/features/booking/calendarStats";
import { addDays, getLocationScope, todayInZone, zonedWallTimeToUtc } from "@/features/booking/domain/calendar";
import type { StatsPeriod } from "@/lib/period";
import type {
  CalendarData,
  ListData,
  BookingsFilter,
  TodayBooking,
  TodayData,
  TodayCustomerInsight,
} from "@/features/booking/dashboardTypes";
import { buildCustomerInsight, HISTORY_COLUMNS, type HistoryRow } from "@/features/booking/todayInsights";

export type { CalendarData, ListData, BookingsFilter, TodayData } from "@/features/booking/dashboardTypes";

// Server-side data layer for the widget dashboard. Every read here is bounded
// (a month window, a page, a period window, or a SQL aggregate) so the dashboard
// scales to any booking volume instead of shipping the whole table to the
// browser — the previous approach silently capped at PostgREST's 1000-row
// ceiling, hiding every booking past the earliest 1000. The loader uses these
// for first paint; the /dashboard API route uses the same functions for every
// subsequent interaction, so SSR and client fetches never diverge.

const DAY_MS = 24 * 60 * 60 * 1000;

// The BookingRowData column set, plus the two ids used to resolve the booker's
// account (they never cross the wire — toRow drops them).
const ROW_COLUMNS =
  "id, instance_id, service_id, customer_name, customer_email, service_name, starts_at, ends_at, price_cents, status, customer_phone, customer_address, staff_id, staff_name, services, location_id, manage_token, notes, created_by_user_id, owner_user_id";

type RowRecord = Pick<
  WidgetBooking,
  | "id" | "instance_id" | "service_id" | "customer_name" | "customer_email"
  | "service_name" | "starts_at" | "ends_at" | "price_cents" | "status"
  | "customer_phone" | "customer_address" | "staff_id" | "staff_name"
  | "services" | "location_id" | "manage_token" | "notes" | "owner_user_id" | "created_by_user_id"
>;

// The customer's account, when they booked while logged in. Manual bookings
// carry the OWNER's id in created_by_user_id, so those never link. Never
// matched by email (would attach strangers' accounts / leak account existence).
function bookerId(r: RowRecord): string | null {
  return r.created_by_user_id && r.created_by_user_id !== r.owner_user_id ? r.created_by_user_id : null;
}

// Batch-load the public profile bits (profiles are world-readable) for a set of
// account ids. Demo/placeholder profiles are still real public pages, so they link.
async function fetchProfileLinks(
  supabase: SupabaseClient,
  ids: (string | null)[]
): Promise<Map<string, CustomerProfileLink>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, CustomerProfileLink>();
  if (unique.length === 0) return map;
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", unique);
  for (const p of (data ?? []) as ({ id: string } & CustomerProfileLink)[]) {
    map.set(p.id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url });
  }
  return map;
}

async function toRows(supabase: SupabaseClient, records: RowRecord[]): Promise<BookingRowData[]> {
  const profiles = await fetchProfileLinks(supabase, records.map(bookerId));
  return records.map((r) => {
    const id = bookerId(r);
    return { ...toRow(r), customer_profile: (id && profiles.get(id)) || null };
  });
}

function toRow(r: RowRecord): BookingRowData {
  return {
    id: r.id,
    instance_id: r.instance_id,
    service_id: r.service_id,
    customer_name: r.customer_name,
    customer_email: r.customer_email,
    service_name: r.service_name,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    price_cents: r.price_cents,
    status: r.status,
    customer_phone: r.customer_phone,
    customer_address: r.customer_address,
    staff_id: r.staff_id,
    staff_name: r.staff_name,
    services: r.services ?? null,
    location_id: r.location_id,
    manage_token: r.manage_token,
    notes: r.notes,
  };
}

// A location filter that treats null (legacy, location-less instances) as its
// own scope, matching the client's `b.location_id === currentLocationId`.
function scopeLocation<T>(query: T, locationId: string | null): T {
  const q = query as { eq: (c: string, v: string) => T; is: (c: string, v: null) => T };
  return locationId === null ? q.is("location_id", null) : q.eq("location_id", locationId);
}

// PostgREST `.or()` takes a comma/paren-delimited grammar, so strip the few
// characters a raw search box could inject before interpolating it.
function sanitize(q: string): string {
  return q.replace(/[,()*]/g, " ").trim();
}

function searchOr(q: string): string {
  const safe = sanitize(q);
  return `customer_name.ilike.*${safe}*,customer_email.ilike.*${safe}*,service_name.ilike.*${safe}*`;
}

// ── Calendar month grid ──────────────────────────────────────────────────────
// `monthKey` is "YYYY-MM". The window is the month's whole Monday-first grid
// (the full weeks around the 1st and the last day), so the week view can show
// any week of that grid without a second fetch. It's over-fetched by a day on
// each UTC edge so every booking whose *local* (widget-tz) day lands in the
// grid is included — the client groups precisely by tz day-key.
export async function fetchCalendarData(
  supabase: SupabaseClient,
  opts: { instanceId: string; locationId: string | null; monthKey: string }
): Promise<CalendarData> {
  const { instanceId, locationId, monthKey } = opts;
  const [y, m] = monthKey.split("-").map(Number);
  const first = Date.UTC(y, m - 1, 1);
  const next = Date.UTC(y, m, 1);
  const lead = (new Date(first).getUTCDay() + 6) % 7; // Monday = 0
  const trail = (7 - ((new Date(next).getUTCDay() + 6) % 7)) % 7;
  const startUtc = first - (lead + 1) * DAY_MS;
  const endUtc = next + (trail + 1) * DAY_MS;

  let q = supabase
    .from("widget_bookings")
    .select(ROW_COLUMNS)
    .eq("instance_id", instanceId)
    .gte("starts_at", new Date(startUtc).toISOString())
    .lt("starts_at", new Date(endUtc).toISOString())
    .order("starts_at", { ascending: true })
    .limit(2000);
  q = scopeLocation(q, locationId);
  const { data } = await q;
  const bookings = await toRows(supabase, (data ?? []) as RowRecord[]);

  return { monthKey, bookings };
}

// ── Bookings list (filter + search + offset pagination) ──────────────────────
export async function fetchListData(
  supabase: SupabaseClient,
  opts: {
    instanceId: string;
    locationId: string | null;
    filter: BookingsFilter;
    query: string;
    limit: number;
    offset: number;
  }
): Promise<ListData> {
  const { instanceId, locationId, filter, query, limit, offset } = opts;
  const nowIso = new Date().toISOString();
  const hasQuery = sanitize(query).length > 0;

  // Every list query shares the same instance + location + (optional) search
  // scope; only the status/time predicate and ordering differ per filter.
  const base = () => {
    let q = supabase.from("widget_bookings").select(ROW_COLUMNS, { count: "exact" }).eq("instance_id", instanceId);
    q = scopeLocation(q, locationId);
    if (hasQuery) q = q.or(searchOr(query));
    return q;
  };

  // Non-"all" filters are a single ordered, ranged query — count comes free.
  if (filter !== "all") {
    let q = base();
    if (filter === "upcoming") q = q.eq("status", "confirmed").gte("starts_at", nowIso).order("starts_at", { ascending: true });
    else if (filter === "past") q = q.eq("status", "confirmed").lt("starts_at", nowIso).order("starts_at", { ascending: false });
    else q = q.eq("status", "cancelled").order("starts_at", { ascending: false });
    const { data, count } = await q.range(offset, offset + limit - 1);
    return { bookings: await toRows(supabase, (data ?? []) as RowRecord[]), total: count ?? 0 };
  }

  // "all" mirrors the old client ordering: upcoming group (starts_at >= now)
  // soonest-first, then the rest most-recent-first — independent of status, so a
  // cancelled-but-future booking still sorts into the upcoming group. Two buckets
  // split at `now`, paginated by offset across the A→B boundary.
  const countHead = async (build: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const { count } = await build(base()).range(0, 0);
    return count ?? 0;
  };
  const aBuild = (q: ReturnType<typeof base>) => q.gte("starts_at", nowIso);
  const bBuild = (q: ReturnType<typeof base>) => q.lt("starts_at", nowIso);
  const countA = await countHead(aBuild);
  const countB = await countHead(bBuild);
  const total = countA + countB;

  const rows: RowRecord[] = [];
  // Slice from bucket A (ascending) while the window still overlaps it.
  if (offset < countA && rows.length < limit) {
    const from = offset;
    const to = Math.min(countA - 1, offset + limit - 1);
    const { data } = await aBuild(base()).order("starts_at", { ascending: true }).range(from, to);
    rows.push(...((data ?? []) as RowRecord[]));
  }
  // Then continue into bucket B (descending) for whatever remains.
  if (rows.length < limit) {
    const need = limit - rows.length;
    const bStart = Math.max(0, offset - countA);
    const { data } = await bBuild(base()).order("starts_at", { ascending: false }).range(bStart, bStart + need - 1);
    rows.push(...((data ?? []) as RowRecord[]));
  }
  return { bookings: await toRows(supabase, rows), total };
}

// ── Overview (trend + KPIs + capacity/forecast), aggregated server-side ──────
// buildOverview only ever looks back `pastUnits` periods (≤6 months) plus one
// future bucket, so a window of [-6 months, +2 months] around now is exact for
// every period — and it also covers the capacity (next 7 days) and forecast
// (rest of this month) horizons. We fetch that window (paginating past the
// 1000-row cap when a very busy account exceeds it) and run the pure builder.
// Staffed scopes additionally read the per-staff segments, but only for the
// short live horizon those two sections need.
const OVERVIEW_COLUMNS =
  "id, status, starts_at, ends_at, price_cents, service_name, service_id, duration_min, staff_id, services";

export async function fetchOverviewData(
  supabase: SupabaseClient,
  opts: {
    instanceId: string;
    locationId: string | null;
    config: CalendarConfig;
    timezone: string;
    currencySymbol: string;
    locale: string;
    period: StatsPeriod;
    shareUrl: string | null;
  }
): Promise<WidgetOverviewData> {
  const { instanceId, locationId, config, timezone, currencySymbol, locale, period, shareUrl } = opts;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));

  const fetchBookings = async () => {
    const rows: OverviewBookingRow[] = [];
    const PAGE = 1000;
    for (let page = 0; ; page++) {
      let q = supabase
        .from("widget_bookings")
        .select(OVERVIEW_COLUMNS)
        .eq("instance_id", instanceId)
        .gte("starts_at", start.toISOString())
        .lt("starts_at", end.toISOString())
        .order("starts_at", { ascending: true })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      q = scopeLocation(q, locationId);
      const { data } = await q;
      const batch = (data ?? []) as OverviewBookingRow[];
      rows.push(...batch);
      if (batch.length < PAGE) break;
    }
    return rows;
  };

  // Segments: confirmed, this instance + location bucket, from a day before
  // now to a day past the later of (now + 7d, month end) — ≤ ~33 days, served
  // by the (instance_id, starts_at) partial index. Unstaffed scopes skip it:
  // the booking row's own span is the single resource's busy time.
  const fetchSegments = async (): Promise<OverviewSegment[]> => {
    if (getLocationScope(config, locationId).staff.length === 0) return [];
    const horizon = Math.max(now.getTime() + 8 * DAY_MS, Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 2));
    let q = supabase
      .from("widget_booking_segments")
      .select("booking_id, staff_id, starts_at, ends_at")
      .eq("instance_id", instanceId)
      .eq("status", "confirmed")
      .gte("starts_at", new Date(now.getTime() - DAY_MS).toISOString())
      .lt("starts_at", new Date(horizon).toISOString())
      .limit(5000);
    q = scopeLocation(q, locationId);
    const { data } = await q;
    return (data ?? []) as OverviewSegment[];
  };

  const [rows, segments] = await Promise.all([fetchBookings(), fetchSegments()]);
  return buildOverview(rows, timezone, currencySymbol, shareUrl, locale, period, {
    config,
    locationId,
    segments,
    now,
  });
}

// ── Customers (all-time rollup) via the SQL aggregate RPC ─────────────────────
export async function fetchCustomersData(
  supabase: SupabaseClient,
  opts: { instanceId: string; locationId: string | null; timezone: string; currencySymbol: string }
): Promise<WidgetCustomersData> {
  const { instanceId, locationId, timezone, currencySymbol } = opts;
  const { data } = await supabase.rpc("widget_customers_summary", {
    p_instance_id: instanceId,
    p_location_id: locationId,
  });
  const rows = (data ?? []) as {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    bookings: number;
    upcoming: number;
    cancelled: number;
    revenue_cents: number;
    last_visit: string | null;
    next_visit: string | null;
    profile_id: string | null;
  }[];
  const profiles = await fetchProfileLinks(supabase, rows.map((r) => r.profile_id));
  const customers: CustomerSummary[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    phone: r.phone,
    bookings: r.bookings,
    upcoming: r.upcoming,
    cancelled: r.cancelled,
    revenueCents: r.revenue_cents,
    lastVisit: r.last_visit,
    nextVisit: r.next_visit,
    profile: (r.profile_id && profiles.get(r.profile_id)) || null,
  }));
  return { timezone, currencySymbol, customers };
}

// ── One customer's booking history (the Customers-tab detail modal) ──────────
// `customerId` is the rollup key from widget_customers_summary: the lowercased
// email, `phone:<phone>` for an email-less customer, or `user:<id>` for an
// account booking with neither. Matching mirrors that
// key so the history lines up with the row's counts. Capped — a single customer
// never comes close, and the modal only needs recent history.
export async function fetchCustomerBookings(
  supabase: SupabaseClient,
  opts: { instanceId: string; locationId: string | null; customerId: string }
): Promise<BookingRowData[]> {
  const { instanceId, locationId, customerId } = opts;
  let q = supabase.from("widget_bookings").select(ROW_COLUMNS).eq("instance_id", instanceId);
  q = filterByCustomerKey(scopeLocation(q, locationId), customerId);
  const { data } = await q.order("starts_at", { ascending: false }).limit(200);
  return toRows(supabase, (data ?? []) as RowRecord[]);
}

// Narrows a widget_bookings query to one customer rollup key (see
// widget_customers_summary): `user:<id>`, `phone:<phone>` or a lowercased email.
function filterByCustomerKey<T>(query: T, customerId: string): T {
  const q = query as unknown as {
    eq: (c: string, v: string) => typeof q;
    or: (f: string) => typeof q;
    ilike: (c: string, v: string) => typeof q;
  };
  if (customerId.startsWith("user:")) {
    // Mirror the RPC: only bookings with no email and no phone fall back to this key.
    return q
      .eq("created_by_user_id", customerId.slice("user:".length))
      .or("customer_email.is.null,customer_email.eq.")
      .or("customer_phone.is.null,customer_phone.eq.") as unknown as T;
  }
  if (customerId.startsWith("phone:")) {
    return q
      .eq("customer_phone", customerId.slice("phone:".length))
      .or("customer_email.is.null,customer_email.eq.") as unknown as T;
  }
  // ilike for case-insensitivity; escape its wildcards so the email matches literally.
  return q.ilike("customer_email", customerId.replace(/[\\%_]/g, (c) => `\\${c}`)) as unknown as T;
}

// The rollup key a booking files under — the TS twin of the RPC's coalesce().
function customerKeyOf(r: RowRecord): string | null {
  const email = r.customer_email?.trim().toLowerCase();
  if (email) return email;
  const phone = r.customer_phone?.trim();
  if (phone) return `phone:${phone}`;
  const id = bookerId(r);
  return id ? `user:${id}` : null;
}

// ── Today (the Today tab) ────────────────────────────────────────────────────
// Everything bounded to one local day: today's rows, their per-staff segments,
// the first booking after today, and a capped history per customer seen today
// (≤ MAX_INSIGHT_CUSTOMERS lookups of ≤ 200 rows each) for the history and
// preferences panel.
const TODAY_COLUMNS = `${ROW_COLUMNS}, duration_min`;
const MAX_INSIGHT_CUSTOMERS = 40;

export async function fetchTodayData(
  supabase: SupabaseClient,
  opts: {
    instanceId: string;
    locationId: string | null;
    config: CalendarConfig;
    timezone: string;
    currencySymbol: string;
  }
): Promise<TodayData> {
  const { instanceId, locationId, config, timezone, currencySymbol } = opts;
  const now = new Date();
  const date = todayInZone(timezone, now);
  const dayStart = zonedWallTimeToUtc(date, "00:00", timezone).toISOString();
  const dayEnd = zonedWallTimeToUtc(addDays(date, 1), "00:00", timezone).toISOString();
  const staffed = getLocationScope(config, locationId).staff.length > 0;

  const todayQuery = scopeLocation(
    supabase
      .from("widget_bookings")
      .select(TODAY_COLUMNS)
      .eq("instance_id", instanceId)
      .gte("starts_at", dayStart)
      .lt("starts_at", dayEnd)
      .order("starts_at", { ascending: true })
      .limit(500),
    locationId
  );
  const segmentsQuery = staffed
    ? scopeLocation(
        supabase
          .from("widget_booking_segments")
          .select("booking_id, staff_id, starts_at, ends_at")
          .eq("instance_id", instanceId)
          .eq("status", "confirmed")
          .gte("starts_at", dayStart)
          .lt("starts_at", dayEnd)
          .limit(2000),
        locationId
      )
    : null;
  const nextQuery = scopeLocation(
    supabase
      .from("widget_bookings")
      .select(ROW_COLUMNS)
      .eq("instance_id", instanceId)
      .eq("status", "confirmed")
      .gte("starts_at", dayEnd)
      .order("starts_at", { ascending: true })
      .limit(1),
    locationId
  );

  const [{ data: todayData }, segmentsRes, { data: nextData }] = await Promise.all([
    todayQuery,
    segmentsQuery ?? Promise.resolve({ data: [] }),
    nextQuery,
  ]);
  const todayRecords = (todayData ?? []) as (RowRecord & Pick<WidgetBooking, "duration_min">)[];
  const nextRecords = (nextData ?? []) as RowRecord[];

  const schedule = buildTodaySchedule(
    todayRecords.filter((r) => r.status === "confirmed"),
    { config, locationId, timezone, segments: (segmentsRes.data ?? []) as OverviewSegment[], now }
  );

  const withKey = async (records: RowRecord[]): Promise<TodayBooking[]> => {
    const rows = await toRows(supabase, records);
    return rows.map((row, i) => ({ ...row, customer_key: customerKeyOf(records[i]) }));
  };
  const [bookings, nextRows] = await Promise.all([withKey(todayRecords), withKey(nextRecords)]);
  const nextAfterToday = nextRows[0] ?? null;

  const keys = [
    ...new Set(
      [...bookings, ...(nextAfterToday ? [nextAfterToday] : [])]
        .map((b) => b.customer_key)
        .filter((k): k is string => Boolean(k))
    ),
  ].slice(0, MAX_INSIGHT_CUSTOMERS);
  const histories = await Promise.all(
    keys.map(async (key) => {
      let q = supabase.from("widget_bookings").select(HISTORY_COLUMNS).eq("instance_id", instanceId);
      q = filterByCustomerKey(scopeLocation(q, locationId), key);
      const { data } = await q.order("starts_at", { ascending: false }).limit(200);
      return [key, (data ?? []) as HistoryRow[]] as const;
    })
  );

  const insights: Record<string, TodayCustomerInsight> = {};
  for (const [key, rows] of histories) {
    insights[key] = buildCustomerInsight(rows, { dayStart, dayEnd, timezone });
  }

  return {
    date,
    timezone,
    currencySymbol,
    bookings,
    hours: schedule.hours,
    openMin: schedule.openMin,
    bookedMin: schedule.bookedMin,
    blocks: schedule.blocks,
    gaps: schedule.gaps,
    lanes: schedule.lanes,
    nextAfterToday,
    insights,
  };
}
