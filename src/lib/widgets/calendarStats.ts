import type { WidgetBooking } from "@/lib/types";
import type { WidgetOverviewData, OverviewBooking } from "@/components/widgets/calendar/WidgetOverview";
import type { WidgetBookingsData } from "@/components/widgets/calendar/WidgetBookings";
import type { WidgetCustomersData, CustomerSummary } from "@/components/widgets/calendar/WidgetCustomers";
import { buildPeriodBuckets, type StatsPeriod } from "@/lib/period";

// Aggregation builders for the widget dashboard tabs (Overview/Bookings/
// Customers). Pure functions over a bookings array so they can run either
// server-side (initial data) or client-side (WidgetWorkspace, recomputing
// when the owner switches the scoped location) with identical results.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function toOverviewBooking(b: WidgetBooking): OverviewBooking {
  return {
    id: b.id,
    instance_id: b.instance_id,
    service_id: b.service_id,
    customer_name: b.customer_name,
    customer_email: b.customer_email,
    service_name: b.service_name,
    starts_at: b.starts_at,
    price_cents: b.price_cents,
    status: b.status,
    customer_phone: b.customer_phone,
    manage_token: b.manage_token,
    staff_id: b.staff_id,
    staff_name: b.staff_name,
    location_id: b.location_id,
  };
}

export function buildOverview(
  bookings: WidgetBooking[],
  timezone: string,
  currencySymbol: string,
  shareUrl: string | null,
  locale: string,
  period: StatsPeriod = "month"
): WidgetOverviewData {
  const now = Date.now();
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

  // Bookings by service.
  const byService = new Map<string, { count: number; revenueCents: number }>();
  for (const b of inRange) {
    const cur = byService.get(b.service_name) ?? { count: 0, revenueCents: 0 };
    cur.count += 1;
    cur.revenueCents += b.price_cents ?? 0;
    byService.set(b.service_name, cur);
  }
  const services = [...byService.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count);

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
    shareUrl,
  };
}

// Full booking list for the Bookings tab, newest first. The tab paginates
// client-side, so the whole set is shipped once and sliced in the browser.
export function buildBookings(
  bookings: WidgetBooking[],
  timezone: string,
  currencySymbol: string
): WidgetBookingsData {
  const sorted = [...bookings].sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return {
    timezone,
    currencySymbol,
    now: Date.now(),
    bookings: sorted.map(toOverviewBooking),
  };
}

// Roll bookings up per customer (keyed by email). Contact name/phone come from
// the customer's most recently created booking.
export function buildCustomers(
  bookings: WidgetBooking[],
  timezone: string,
  currencySymbol: string
): WidgetCustomersData {
  const now = Date.now();

  const map = new Map<string, CustomerSummary>();
  const latestContact = new Map<string, number>(); // email → newest created_at ms

  for (const b of bookings) {
    const key = b.customer_email.trim().toLowerCase();
    if (!key) continue;
    const created = new Date(b.created_at).getTime();
    let c = map.get(key);
    if (!c) {
      c = {
        email: b.customer_email,
        name: b.customer_name,
        phone: b.customer_phone,
        bookings: 0,
        upcoming: 0,
        cancelled: 0,
        revenueCents: 0,
        lastVisit: null,
        nextVisit: null,
      };
      map.set(key, c);
    }

    // Freshest contact details win.
    if (created >= (latestContact.get(key) ?? -1)) {
      latestContact.set(key, created);
      c.name = b.customer_name;
      if (b.customer_phone) c.phone = b.customer_phone;
    }

    if (b.status === "cancelled") {
      c.cancelled += 1;
      continue;
    }

    // confirmed
    c.bookings += 1;
    c.revenueCents += b.price_cents ?? 0;
    const t = new Date(b.starts_at).getTime();
    if (t >= now) {
      c.upcoming += 1;
      if (!c.nextVisit || b.starts_at < c.nextVisit) c.nextVisit = b.starts_at;
    } else {
      if (!c.lastVisit || b.starts_at > c.lastVisit) c.lastVisit = b.starts_at;
    }
  }

  const customers = [...map.values()].sort(
    (a, b) =>
      b.upcoming - a.upcoming ||
      b.revenueCents - a.revenueCents ||
      b.bookings - a.bookings ||
      a.name.localeCompare(b.name)
  );

  return { timezone, currencySymbol, customers };
}
