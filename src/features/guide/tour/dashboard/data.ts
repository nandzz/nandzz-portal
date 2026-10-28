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
import type { GuideTourSample } from "../../content";

// Sample data for "Studio Lume", built relative to `now` so Today always looks
// like today. People's names are data; the salon's own words (services, notes)
// come from the locale (`tour.sample`).

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const CURRENCY = "€";
const INSTANCE = "tour-instance";

export const TOUR_STAFF = [
  { id: "staff-giulia", name: "Giulia" },
  { id: "staff-marco", name: "Marco" },
  { id: "staff-sara", name: "Sara" },
] as const;

const SERVICES = {
  cut: { id: "svc-cut", price: 4000 },
  colour: { id: "svc-colour", price: 7500 },
  beard: { id: "svc-beard", price: 1800 },
  blow: { id: "svc-blow", price: 2500 },
} as const;
type ServiceKey = keyof typeof SERVICES;

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
  staff: number; // index into TOUR_STAFF
  from: number; // minutes from now
  mins: number;
  note?: boolean; // carries the sample booking note
  cancelled?: boolean;
};

function booking(s: Seed, now: number, sample: GuideTourSample): TodayBooking {
  const svc = SERVICES[s.service];
  const staff = TOUR_STAFF[s.staff];
  const email = emailOf(s.customer);
  return {
    id: s.id,
    instance_id: INSTANCE,
    service_id: svc.id,
    customer_name: s.customer,
    customer_email: email,
    service_name: sample.services[s.service],
    starts_at: iso(now + s.from * MIN),
    ends_at: iso(now + (s.from + s.mins) * MIN),
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
function insights(now: number, sample: GuideTourSample): Record<string, TodayCustomerInsight> {
  const { cut, colour, blow } = sample.services;
  const ago = (days: number) => iso(now - days * DAY);
  return {
    [emailOf("Chiara Moretti")]: {
      pastVisits: 9,
      spentCents: 61500,
      cancelled: 1,
      firstVisit: ago(380),
      lastVisit: ago(42),
      nextVisit: null,
      avgGapDays: 42,
      topServices: [
        { name: colour, count: 6 },
        { name: cut, count: 3 },
      ],
      topStaff: { name: "Sara", count: 7, of: 9 },
      usualDaypart: "afternoon",
      usualWeekday: 4,
      notes: [
        { date: ago(42), text: sample.clientNotes[0] },
        { date: ago(84), text: sample.clientNotes[1] },
      ],
      recent: [
        { id: "r1", starts_at: ago(42), services: colour, price_cents: 7500 },
        { id: "r2", starts_at: ago(84), services: `${colour}, ${blow}`, price_cents: 10000 },
        { id: "r3", starts_at: ago(126), services: cut, price_cents: 4000 },
      ],
    },
    [emailOf("Davide Ferrari")]: {
      pastVisits: 4,
      spentCents: 16000,
      cancelled: 0,
      firstVisit: ago(150),
      lastVisit: ago(35),
      nextVisit: null,
      avgGapDays: 35,
      topServices: [{ name: cut, count: 4 }],
      topStaff: { name: "Marco", count: 4, of: 4 },
      usualDaypart: null,
      usualWeekday: null,
      notes: [],
      recent: [{ id: "r4", starts_at: ago(35), services: cut, price_cents: 4000 }],
    },
    [emailOf("Anna Conti")]: {
      pastVisits: 2,
      spentCents: 5000,
      cancelled: 0,
      firstVisit: ago(60),
      lastVisit: ago(28),
      nextVisit: null,
      avgGapDays: 32,
      topServices: [{ name: blow, count: 2 }],
      topStaff: null,
      usualDaypart: null,
      usualWeekday: null,
      notes: [],
      recent: [{ id: "r5", starts_at: ago(28), services: blow, price_cents: 2500 }],
    },
  };
}

export function buildToday(now: number, sample: GuideTourSample): TodayData {
  const bookings = TODAY_SEEDS.map((s) => booking(s, now, sample));
  const confirmed = TODAY_SEEDS.filter((s) => !s.cancelled);
  const blocks = confirmed.map((s) => ({
    bookingId: s.id,
    staffId: TOUR_STAFF[s.staff].id,
    start: iso(now + s.from * MIN),
    end: iso(now + (s.from + s.mins) * MIN),
  }));
  const bookedMin = confirmed.reduce((sum, s) => sum + s.mins, 0);
  const tomorrow = booking({ id: "tm1", customer: "Elena Rossi", service: "colour", staff: 0, from: 17 * 60, mins: 90 }, now, sample);

  return {
    date: new Intl.DateTimeFormat("en-CA").format(new Date(now)),
    timezone: tourTimezone(),
    currencySymbol: CURRENCY,
    bookings,
    // Open from well before now to a few hours after: the ribbon snaps to hours.
    hours: [{ start: iso(now - 200 * MIN), end: iso(now + 260 * MIN) }],
    openMin: 3 * 460,
    bookedMin,
    blocks,
    // Free time long enough for the shortest service (20 min), still ahead.
    gaps: [
      { start: iso(now + 70 * MIN), end: iso(now + 100 * MIN) },
      { start: iso(now + 150 * MIN), end: iso(now + 260 * MIN) },
    ],
    lanes: TOUR_STAFF.map((s) => ({ id: s.id, name: s.name })),
    nextAfterToday: tomorrow,
    insights: insights(now, sample),
  };
}

// ── Dashboard tab ───────────────────────────────────────────────────────────

export function buildOverview(now: number, locale: string, sample: GuideTourSample): WidgetOverviewData {
  const { cut, colour, blow, beard } = sample.services;
  const tz = tourTimezone();
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

  // Next 7 days, today first. Sunday is closed; staff-minutes summed over 3 staff.
  const fill = [0.58, 0.82, 0.7, 0.94, 0.46, 1, 0.64];
  const days = fill.map((f, i) => {
    const d = new Date(now + i * DAY);
    const closed = d.getDay() === 0;
    const openMin = closed ? 0 : 3 * 460;
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
    currencySymbol: CURRENCY,
    totals: { upcoming: 31, confirmedInPeriod: 145, revenueCents: 598100, next7: 24, cancelled: 9 },
    trend,
    services: [
      { name: cut, count: 64, revenueCents: 256000 },
      { name: colour, count: 31, revenueCents: 232500 },
      { name: blow, count: 28, revenueCents: 70000 },
      { name: beard, count: 22, revenueCents: 39600 },
    ],
    capacity: { referenceService: { name: cut, durationMin: 45 }, days },
    forecast: {
      monthLabel: month.format(new Date(now)),
      earnedCents: 296000,
      bookedCents: 96000,
      potentialCents: 118000,
      avgTicketCents: 4125,
    },
    shareUrl: "/studiolume/booking",
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

export function buildBookings(now: number, sample: GuideTourSample): { calendar: CalendarData; list: ListData } {
  const rows: BookingRowData[] = LIST_SEEDS.map((s) => booking(s, now, sample));
  const today = buildToday(now, sample);
  const confirmedToday = today.bookings.filter((b) => b.status === "confirmed");
  const nextToday = confirmedToday.find((b) => Date.parse(b.starts_at) > now);
  const monthKey = new Intl.DateTimeFormat("en-CA", { timeZone: tourTimezone(), year: "numeric", month: "2-digit" }).format(
    new Date(now)
  );
  return {
    calendar: {
      monthKey,
      bookings: rows,
      today: {
        count: confirmedToday.length,
        done: confirmedToday.filter((b) => Date.parse(b.ends_at) <= now).length,
        revenueCents: confirmedToday.reduce((sum, b) => sum + (b.price_cents ?? 0), 0),
        nextStartsAt: nextToday?.starts_at ?? null,
      },
    },
    list: { bookings: rows, total: 148 },
  };
}

// ── Customers tab ───────────────────────────────────────────────────────────

export function buildCustomers(now: number): WidgetCustomersData {
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
    revenueCents: spent,
    lastVisit: last === null ? null : day(last),
    nextVisit: next === null ? null : day(next),
    profile: null,
  });

  return {
    timezone: tourTimezone(),
    currencySymbol: CURRENCY,
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
