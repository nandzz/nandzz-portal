import type { BookingRowData } from "@/features/booking/components/calendar/BookingRow";
import type { WidgetOverviewData } from "@/features/booking/components/calendar/WidgetOverview";
import type { CustomerSummary, WidgetCustomersData } from "@/features/booking/components/calendar/WidgetCustomers";
import type {
  CalendarData,
  ListData,
  TodayBooking,
  TodayCustomerInsight,
  TodayData,
} from "@/features/booking/dashboardTypes";
import { currencySymbol } from "@/features/booking/domain/messages";
import type { GuideTourSample } from "../../content";
import type { TourBusiness } from "../business";

// Sample data for "Studio Lume", built relative to `now` so Today always looks
// like today. People's names are data; the salon's own words (services, notes)
// come from the locale (`tour.sample`). With a TourBusiness, its own staff,
// services and prices take the salon's place; the customers stay sample data.

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const INSTANCE = "tour-instance";

type ServiceKey = "cut" | "colour" | "beard" | "blow";
const SERVICE_KEYS: ServiceKey[] = ["cut", "colour", "beard", "blow"];

// Studio Lume's prices; every other sample amount is sized off their total.
const LUME_PRICES: Record<ServiceKey, number> = { cut: 4000, colour: 7500, beard: 1800, blow: 2500 };
const LUME_MINS: Record<ServiceKey, number> = { cut: 45, colour: 90, beard: 20, blow: 30 };
const LUME_REVENUE = 598100;

type CastService = { id: string; name: string; price: number; mins: number };

// Who the sample data is about: the staff lanes, the four service slots the
// seeds book, the currency and how sample amounts (spend, forecast) scale.
export type TourCast = {
  staff: { id: string; name: string }[];
  services: Record<ServiceKey, CastService>;
  currency: string; // symbol
  priceScale: number;
  shareUrl: string;
};

export function castOf(sample: GuideTourSample, business: TourBusiness | null): TourCast {
  const own = business?.location.services.filter((s) => s.name.trim()) ?? [];
  if (!business || own.length === 0) {
    return {
      staff: [
        { id: "staff-giulia", name: "Giulia" },
        { id: "staff-marco", name: "Marco" },
        { id: "staff-sara", name: "Sara" },
      ],
      services: Object.fromEntries(
        SERVICE_KEYS.map((k) => [k, { id: `svc-${k}`, name: sample.services[k], price: LUME_PRICES[k], mins: LUME_MINS[k] }])
      ) as Record<ServiceKey, CastService>,
      currency: currencySymbol("eur"),
      priceScale: 1,
      shareUrl: "/studiolume/booking",
    };
  }
  // A business with fewer than four services repeats them across the slots.
  const services = Object.fromEntries(
    SERVICE_KEYS.map((k, i) => {
      const s = own[i % own.length];
      return [k, { id: s.id, name: s.name, price: s.price_cents ?? 0, mins: Math.max(5, s.duration_min) }];
    })
  ) as Record<ServiceKey, CastService>;
  const staff = business.location.staff.slice(0, 3).map((s) => ({ id: s.id, name: s.name }));
  return {
    // No staff: the business itself is the one bookable lane.
    staff: staff.length > 0 ? staff : [{ id: "staff-owner", name: business.name }],
    services,
    currency: currencySymbol(business.currency),
    priceScale: overviewRevenue(services) / LUME_REVENUE,
    shareUrl: `/${business.username}/booking`,
  };
}

// How often each slot was booked this month (Dashboard tab), most booked first.
const MONTH_COUNTS: [ServiceKey, number][] = [
  ["cut", 64],
  ["colour", 31],
  ["blow", 28],
  ["beard", 22],
];
const overviewRevenue = (services: TourCast["services"]) =>
  MONTH_COUNTS.reduce((sum, [k, n]) => sum + n * services[k].price, 0);

// Slots that repeat a service (a business with < 4 services) add up as one row.
function mergeByName<T extends { name: string; count: number; revenueCents?: number }>(rows: T[]): T[] {
  const out = new Map<string, T>();
  for (const r of rows) {
    const prev = out.get(r.name);
    if (!prev) out.set(r.name, { ...r });
    else {
      prev.count += r.count;
      if (prev.revenueCents !== undefined) prev.revenueCents += r.revenueCents ?? 0;
    }
  }
  return [...out.values()].sort((a, b) => b.count - a.count);
}

const iso = (ms: number) => new Date(ms).toISOString();
const emailOf = (name: string) => `${name.toLowerCase().replace(/ /g, ".")}@example.com`;

// Round to the minute so every derived time lines up on whole minutes.
export const tourNow = () => Math.floor(Date.now() / MIN) * MIN;

export function tourTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Rome";
}

type Seed = {
  id: string;
  customer: string;
  service: ServiceKey;
  staff: number; // index into the cast's staff (wraps around)
  from: number; // minutes from now
  mins: number;
  note?: boolean; // carries the sample booking note
  cancelled?: boolean;
};

const staffOf = (cast: TourCast, i: number) => cast.staff[i % cast.staff.length];
// A seed's slot is sized for Studio Lume; a longer service keeps that slot so
// the day's appointments never overlap.
const minsOf = (s: Seed, cast: TourCast) => Math.min(s.mins, cast.services[s.service].mins);

function booking(s: Seed, now: number, sample: GuideTourSample, cast: TourCast): TodayBooking {
  const svc = cast.services[s.service];
  const staff = staffOf(cast, s.staff);
  const email = emailOf(s.customer);
  return {
    id: s.id,
    instance_id: INSTANCE,
    service_id: svc.id,
    customer_name: s.customer,
    customer_email: email,
    service_name: svc.name,
    starts_at: iso(now + s.from * MIN),
    ends_at: iso(now + (s.from + minsOf(s, cast)) * MIN),
    price_cents: svc.price,
    status: s.cancelled ? "cancelled" : "confirmed",
    customer_phone: "+39 333 123 4567",
    staff_id: staff.id,
    staff_name: staff.name,
    services: null,
    location_id: null,
    manage_token: `tour-${s.id}`,
    notes: s.note ? sample.bookingNote : null,
    customer_profile: null,
    customer_key: email,
  };
}

const TODAY_SEEDS: Seed[] = [
  { id: "t1", customer: "Elena Rossi", service: "cut", staff: 0, from: -160, mins: 45 },
  { id: "t2", customer: "Luca Bianchi", service: "beard", staff: 1, from: -110, mins: 20 },
  { id: "t3", customer: "Chiara Moretti", service: "colour", staff: 2, from: -25, mins: 90, note: true },
  { id: "t4", customer: "Davide Ferrari", service: "cut", staff: 1, from: 25, mins: 45 },
  { id: "t5", customer: "Anna Conti", service: "blow", staff: 0, from: 40, mins: 30 },
  { id: "t6", customer: "Martina Greco", service: "cut", staff: 0, from: 100, mins: 45 },
  { id: "t7", customer: "Paolo Ricci", service: "beard", staff: 1, from: 105, mins: 20 },
  { id: "t8", customer: "Sofia Marini", service: "colour", staff: 2, from: 130, mins: 90 },
  { id: "t9", customer: "Franco Villa", service: "cut", staff: 1, from: 170, mins: 45, cancelled: true },
];

// What the business knows about a few returning customers (the focus panel).
function insights(now: number, sample: GuideTourSample, cast: TourCast): Record<string, TodayCustomerInsight> {
  const { cut, colour, blow } = cast.services;
  const ago = (days: number) => iso(now - days * DAY);
  const spent = (cents: number) => Math.round(cents * cast.priceScale);
  return {
    [emailOf("Chiara Moretti")]: {
      pastVisits: 9,
      spentCents: spent(61500),
      cancelled: 1,
      firstVisit: ago(380),
      lastVisit: ago(42),
      nextVisit: null,
      avgGapDays: 42,
      topServices: mergeByName([
        { name: colour.name, count: 6 },
        { name: cut.name, count: 3 },
      ]),
      topStaff: { name: staffOf(cast, 2).name, count: 7, of: 9 },
      usualDaypart: "afternoon",
      usualWeekday: 4,
      notes: [
        { date: ago(42), text: sample.clientNotes[0] },
        { date: ago(84), text: sample.clientNotes[1] },
      ],
      recent: [
        { id: "r1", starts_at: ago(42), services: colour.name, price_cents: colour.price },
        { id: "r2", starts_at: ago(84), services: `${colour.name}, ${blow.name}`, price_cents: colour.price + blow.price },
        { id: "r3", starts_at: ago(126), services: cut.name, price_cents: cut.price },
      ],
    },
    [emailOf("Davide Ferrari")]: {
      pastVisits: 4,
      spentCents: spent(16000),
      cancelled: 0,
      firstVisit: ago(150),
      lastVisit: ago(35),
      nextVisit: null,
      avgGapDays: 35,
      topServices: [{ name: cut.name, count: 4 }],
      topStaff: { name: staffOf(cast, 1).name, count: 4, of: 4 },
      usualDaypart: null,
      usualWeekday: null,
      notes: [],
      recent: [{ id: "r4", starts_at: ago(35), services: cut.name, price_cents: cut.price }],
    },
    [emailOf("Anna Conti")]: {
      pastVisits: 2,
      spentCents: spent(5000),
      cancelled: 0,
      firstVisit: ago(60),
      lastVisit: ago(28),
      nextVisit: null,
      avgGapDays: 32,
      topServices: [{ name: blow.name, count: 2 }],
      topStaff: null,
      usualDaypart: null,
      usualWeekday: null,
      notes: [],
      recent: [{ id: "r5", starts_at: ago(28), services: blow.name, price_cents: blow.price }],
    },
  };
}

export function buildToday(now: number, sample: GuideTourSample, cast: TourCast): TodayData {
  const bookings = TODAY_SEEDS.map((s) => booking(s, now, sample, cast));
  const confirmed = TODAY_SEEDS.filter((s) => !s.cancelled);
  const blocks = confirmed.map((s) => ({
    bookingId: s.id,
    staffId: staffOf(cast, s.staff).id,
    start: iso(now + s.from * MIN),
    end: iso(now + (s.from + minsOf(s, cast)) * MIN),
  }));
  const bookedMin = confirmed.reduce((sum, s) => sum + minsOf(s, cast), 0);
  const tomorrow = booking(
    { id: "tm1", customer: "Elena Rossi", service: "colour", staff: 0, from: 17 * 60, mins: 90 },
    now,
    sample,
    cast
  );

  return {
    date: new Intl.DateTimeFormat("en-CA").format(new Date(now)),
    timezone: tourTimezone(),
    currencySymbol: cast.currency,
    bookings,
    // Open from well before now to a few hours after: the ribbon snaps to hours.
    hours: [{ start: iso(now - 200 * MIN), end: iso(now + 260 * MIN) }],
    openMin: cast.staff.length * 460,
    bookedMin,
    blocks,
    // Free time long enough for the shortest service (20 min), still ahead.
    gaps: [
      { start: iso(now + 70 * MIN), end: iso(now + 100 * MIN) },
      { start: iso(now + 150 * MIN), end: iso(now + 260 * MIN) },
    ],
    lanes: cast.staff.map((s) => ({ id: s.id, name: s.name })),
    nextAfterToday: tomorrow,
    insights: insights(now, sample, cast),
  };
}

// ── Dashboard tab ───────────────────────────────────────────────────────────

export function buildOverview(now: number, locale: string, cast: TourCast): WidgetOverviewData {
  const tz = tourTimezone();
  const k = cast.priceScale;
  const scaled = (cents: number) => Math.round(cents * k);
  const revenueCents = overviewRevenue(cast.services);
  const short = new Intl.DateTimeFormat(locale, { timeZone: tz, day: "numeric", month: "short" });
  const weekday = new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: "short", day: "numeric" });
  const month = new Intl.DateTimeFormat(locale, { timeZone: tz, month: "long" });

  // Weekly buckets: the last six weeks happened, the next two are booked ahead.
  const weekly = [14, 18, 16, 22, 19, 24, 17, 9];
  const trend = weekly.map((count, i) => ({
    label: short.format(new Date(now + (i - 5) * 7 * DAY)),
    count,
    isFuture: i > 5,
  }));

  // Next 7 days, today first. Sunday is closed; staff-minutes summed over the staff.
  const fill = [0.58, 0.82, 0.7, 0.94, 0.46, 1, 0.64];
  const days = fill.map((f, i) => {
    const d = new Date(now + i * DAY);
    const closed = d.getDay() === 0;
    const openMin = closed ? 0 : cast.staff.length * 460;
    const bookedMin = closed ? 0 : Math.round(openMin * f);
    return {
      date: new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d),
      label: weekday.format(d),
      openMin,
      bookedMin,
      fits: closed ? 0 : f >= 0.97 ? 0 : Math.floor((openMin - bookedMin) / 75),
      closed,
    };
  });

  return {
    timezone: tz,
    currencySymbol: cast.currency,
    totals: { upcoming: 31, confirmedInPeriod: 145, revenueCents, next7: 24, cancelled: 9 },
    trend,
    services: mergeByName(
      MONTH_COUNTS.map(([key, count]) => ({
        name: cast.services[key].name,
        count,
        revenueCents: count * cast.services[key].price,
      }))
    ),
    capacity: { referenceService: { name: cast.services.cut.name, durationMin: cast.services.cut.mins }, days },
    forecast: {
      monthLabel: month.format(new Date(now)),
      earnedCents: scaled(296000),
      bookedCents: scaled(96000),
      potentialCents: scaled(118000),
      avgTicketCents: Math.round(revenueCents / 145),
    },
    shareUrl: cast.shareUrl,
  };
}

// ── Bookings tab ────────────────────────────────────────────────────────────

const LIST_SEEDS: Seed[] = [
  { id: "l1", customer: "Davide Ferrari", service: "cut", staff: 1, from: 25, mins: 45 },
  { id: "l2", customer: "Anna Conti", service: "blow", staff: 0, from: 40, mins: 30 },
  { id: "l3", customer: "Martina Greco", service: "cut", staff: 0, from: 100, mins: 45 },
  { id: "l4", customer: "Sofia Marini", service: "colour", staff: 2, from: 130, mins: 90 },
  { id: "l5", customer: "Elena Rossi", service: "colour", staff: 0, from: 17 * 60, mins: 90 },
  { id: "l6", customer: "Giorgio Neri", service: "beard", staff: 1, from: 26 * 60, mins: 20 },
  { id: "l7", customer: "Chiara Moretti", service: "cut", staff: 2, from: 3 * 24 * 60, mins: 45 },
  { id: "l8", customer: "Luca Bianchi", service: "cut", staff: 1, from: -110, mins: 20 },
];

export function buildBookings(
  now: number,
  sample: GuideTourSample,
  cast: TourCast
): { calendar: CalendarData; list: ListData } {
  const rows: BookingRowData[] = LIST_SEEDS.map((s) => booking(s, now, sample, cast));
  const monthKey = new Intl.DateTimeFormat("en-CA", { timeZone: tourTimezone(), year: "numeric", month: "2-digit" }).format(
    new Date(now)
  );
  return {
    calendar: {
      monthKey,
      bookings: rows,
    },
    list: { bookings: rows, total: 148 },
  };
}

// ── Customers tab ───────────────────────────────────────────────────────────

export function buildCustomers(now: number, cast: TourCast): WidgetCustomersData {
  const day = (offset: number) => iso(now + offset * DAY);
  const row = (
    name: string,
    bookings: number,
    spent: number,
    last: number | null,
    next: number | null
  ): CustomerSummary => ({
    id: emailOf(name),
    email: emailOf(name),
    name,
    phone: "+39 333 123 4567",
    bookings,
    upcoming: next === null ? 0 : 1,
    cancelled: 0,
    revenueCents: Math.round(spent * cast.priceScale),
    lastVisit: last === null ? null : day(last),
    nextVisit: next === null ? null : day(next),
    profile: null,
  });

  return {
    timezone: tourTimezone(),
    currencySymbol: cast.currency,
    customers: [
      row("Chiara Moretti", 10, 69000, -42, 3),
      row("Elena Rossi", 7, 38500, -18, 1),
      row("Davide Ferrari", 5, 20000, -35, 0),
      row("Sofia Marini", 4, 29000, -50, 0),
      row("Martina Greco", 3, 12000, -21, 0),
      row("Anna Conti", 3, 7500, -28, 0),
      row("Luca Bianchi", 2, 5800, -12, null),
      row("Paolo Ricci", 2, 3600, -64, 0),
    ],
  };
}
