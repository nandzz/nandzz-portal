import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WidgetBooking } from "@/lib/types";
import type { BookingRowData } from "@/features/booking/components/calendar/BookingRow";
import type { WidgetOverviewData } from "@/features/booking/components/calendar/WidgetOverview";
import type { WidgetCustomersData, CustomerSummary } from "@/features/booking/components/calendar/WidgetCustomers";
import { buildOverview } from "@/features/booking/calendarStats";
import type { StatsPeriod } from "@/lib/period";
import type { TodaySnapshot, CalendarData, ListData, BookingsFilter } from "@/features/booking/dashboardTypes";

export type { TodaySnapshot, CalendarData, ListData, BookingsFilter } from "@/features/booking/dashboardTypes";

// Server-side data layer for the widget dashboard. Every read here is bounded
// (a month window, a page, a period window, or a SQL aggregate) so the dashboard
// scales to any booking volume instead of shipping the whole table to the
// browser — the previous approach silently capped at PostgREST's 1000-row
// ceiling, hiding every booking past the earliest 1000. The loader uses these
// for first paint; the /dashboard API route uses the same functions for every
// subsequent interaction, so SSR and client fetches never diverge.

const DAY_MS = 24 * 60 * 60 * 1000;

// The exact BookingRowData column set — nothing wider crosses the wire.
const ROW_COLUMNS =
  "id, instance_id, service_id, customer_name, customer_email, service_name, starts_at, ends_at, price_cents, status, customer_phone, customer_address, staff_id, staff_name, services, location_id, manage_token";

type RowRecord = Pick<
  WidgetBooking,
  | "id" | "instance_id" | "service_id" | "customer_name" | "customer_email"
  | "service_name" | "starts_at" | "ends_at" | "price_cents" | "status"
  | "customer_phone" | "customer_address" | "staff_id" | "staff_name"
  | "services" | "location_id" | "manage_token"
>;

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

// ── Calendar month grid + Today snapshot ─────────────────────────────────────
// `monthKey` is "YYYY-MM". We over-fetch the UTC window by a day on each edge so
// every booking whose *local* (widget-tz) day lands in the month is included —
// the client groups precisely by tz day-key and only renders the month's cells,
// so the padding rows are harmless.
export async function fetchCalendarData(
  supabase: SupabaseClient,
  opts: { instanceId: string; locationId: string | null; monthKey: string; timezone: string }
): Promise<CalendarData> {
  const { instanceId, locationId, monthKey, timezone } = opts;
  const [y, m] = monthKey.split("-").map(Number);
  const startUtc = Date.UTC(y, m - 1, 1) - DAY_MS;
  const endUtc = Date.UTC(y, m, 1) + DAY_MS;

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
  const bookings = ((data ?? []) as RowRecord[]).map(toRow);

  return { monthKey, bookings, today: await fetchToday(supabase, { instanceId, locationId, timezone }) };
}

// Today's confirmed bookings, anchored to the widget timezone. Over-fetch ±1 day
// in UTC, then keep only the rows whose tz day-key equals "today".
async function fetchToday(
  supabase: SupabaseClient,
  opts: { instanceId: string; locationId: string | null; timezone: string }
): Promise<TodaySnapshot> {
  const { instanceId, locationId, timezone } = opts;
  const now = Date.now();
  const dayFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayKey = dayFmt.format(new Date(now));

  let q = supabase
    .from("widget_bookings")
    .select("starts_at, price_cents")
    .eq("instance_id", instanceId)
    .eq("status", "confirmed")
    .gte("starts_at", new Date(now - DAY_MS).toISOString())
    .lt("starts_at", new Date(now + DAY_MS).toISOString());
  q = scopeLocation(q, locationId);
  const { data } = await q;
  const rows = (data ?? []) as { starts_at: string; price_cents: number | null }[];
  const today = rows.filter((r) => dayFmt.format(new Date(r.starts_at)) === todayKey);

  let done = 0;
  let revenueCents = 0;
  let nextStartsAt: string | null = null;
  for (const r of today) {
    const t = new Date(r.starts_at).getTime();
    revenueCents += r.price_cents ?? 0;
    if (t < now) done += 1;
    else if (!nextStartsAt || r.starts_at < nextStartsAt) nextStartsAt = r.starts_at;
  }
  return { count: today.length, done, revenueCents, nextStartsAt };
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
    return { bookings: ((data ?? []) as RowRecord[]).map(toRow), total: count ?? 0 };
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

  const rows: BookingRowData[] = [];
  // Slice from bucket A (ascending) while the window still overlaps it.
  if (offset < countA && rows.length < limit) {
    const from = offset;
    const to = Math.min(countA - 1, offset + limit - 1);
    const { data } = await aBuild(base()).order("starts_at", { ascending: true }).range(from, to);
    rows.push(...((data ?? []) as RowRecord[]).map(toRow));
  }
  // Then continue into bucket B (descending) for whatever remains.
  if (rows.length < limit) {
    const need = limit - rows.length;
    const bStart = Math.max(0, offset - countA);
    const { data } = await bBuild(base()).order("starts_at", { ascending: false }).range(bStart, bStart + need - 1);
    rows.push(...((data ?? []) as RowRecord[]).map(toRow));
  }
  return { bookings: rows, total };
}

// ── Overview (trend + KPIs), aggregated server-side over a bounded window ─────
// buildOverview only ever looks back `pastUnits` periods (≤6 months) plus one
// future bucket, so a window of [-6 months, +2 months] around now is exact for
// every period. We fetch that window (paginating past the 1000-row cap when a
// very busy account exceeds it) and run the same pure builder the client used.
export async function fetchOverviewData(
  supabase: SupabaseClient,
  opts: {
    instanceId: string;
    locationId: string | null;
    timezone: string;
    currencySymbol: string;
    locale: string;
    period: StatsPeriod;
    shareUrl: string | null;
  }
): Promise<WidgetOverviewData> {
  const { instanceId, locationId, timezone, currencySymbol, locale, period, shareUrl } = opts;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));

  const cols = "status, starts_at, price_cents, service_name";
  const rows: Pick<WidgetBooking, "status" | "starts_at" | "price_cents" | "service_name">[] = [];
  const PAGE = 1000;
  for (let page = 0; ; page++) {
    let q = supabase
      .from("widget_bookings")
      .select(cols)
      .eq("instance_id", instanceId)
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    q = scopeLocation(q, locationId);
    const { data } = await q;
    const batch = (data ?? []) as typeof rows;
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }

  return buildOverview(rows as WidgetBooking[], timezone, currencySymbol, shareUrl, locale, period);
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
  }[];
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
  }));
  return { timezone, currencySymbol, customers };
}

// ── One customer's booking history (the Customers-tab detail modal) ──────────
// `customerId` is the rollup key from widget_customers_summary: the lowercased
// email, or `phone:<phone>` for an email-less customer. Matching mirrors that
// key so the history lines up with the row's counts. Capped — a single customer
// never comes close, and the modal only needs recent history.
export async function fetchCustomerBookings(
  supabase: SupabaseClient,
  opts: { instanceId: string; locationId: string | null; customerId: string }
): Promise<BookingRowData[]> {
  const { instanceId, locationId, customerId } = opts;
  let q = supabase.from("widget_bookings").select(ROW_COLUMNS).eq("instance_id", instanceId);
  q = scopeLocation(q, locationId);
  if (customerId.startsWith("phone:")) {
    q = q.eq("customer_phone", customerId.slice("phone:".length)).or("customer_email.is.null,customer_email.eq.");
  } else {
    // ilike for case-insensitivity; escape its wildcards so the email matches literally.
    q = q.ilike("customer_email", customerId.replace(/[\\%_]/g, (c) => `\\${c}`));
  }
  const { data } = await q.order("starts_at", { ascending: false }).limit(200);
  return ((data ?? []) as RowRecord[]).map(toRow);
}
