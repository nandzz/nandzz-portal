import type { BookingRowData } from "@/features/booking/components/calendar/BookingRow";

// Client-safe shapes for the windowed dashboard data. Kept out of
// `dashboardData.ts` (which is `server-only`) so Client Components can import
// the types without pulling the server read layer into the browser bundle.

export type BookingsFilter = "all" | "upcoming" | "past" | "cancelled";

export type TodaySnapshot = {
  count: number;
  done: number;
  revenueCents: number;
  nextStartsAt: string | null;
};

export type CalendarData = {
  monthKey: string; // "YYYY-MM" the rows belong to
  bookings: BookingRowData[];
  today: TodaySnapshot;
};

export type ListData = {
  bookings: BookingRowData[];
  total: number;
};

// ── Today tab ────────────────────────────────────────────────────────────────

// A today row plus the customer rollup key (same derivation as the
// widget_customers_summary RPC) its insight is filed under.
export type TodayBooking = BookingRowData & { customer_key: string | null };

// What the business knows about a customer from their history at this
// location, relative to today. "Before today" excludes today's own visit.
export type TodayCustomerInsight = {
  pastVisits: number; // confirmed, started before today
  spentCents: number; // across those visits
  cancelled: number; // all time
  firstVisit: string | null; // ISO
  lastVisit: string | null; // ISO, most recent confirmed before today
  nextVisit: string | null; // ISO, soonest confirmed after today
  avgGapDays: number | null; // mean days between past visits (needs ≥ 2)
  topServices: { name: string; count: number }[]; // confirmed, most booked first (≤ 3)
  topStaff: { name: string; count: number; of: number } | null; // most frequent staff, when repeated
  usualDaypart: "morning" | "afternoon" | "evening" | null; // when ≥ 60% of visits share it
  usualWeekday: number | null; // 0 = Monday … 6 = Sunday, when ≥ 50% of ≥ 3 visits share it
  notes: { date: string; text: string }[]; // notes left on previous bookings, newest first (≤ 3)
  recent: { id: string; starts_at: string; services: string; price_cents: number | null }[]; // last visits (≤ 3)
};

export type TodayData = {
  date: string; // "YYYY-MM-DD" in the location's timezone
  timezone: string;
  currencySymbol: string;
  bookings: TodayBooking[]; // today's bookings (confirmed + cancelled), soonest first
  hours: { start: string; end: string }[]; // opening windows, ISO
  openMin: number; // staff-minutes open today
  bookedMin: number; // staff-minutes booked today
  blocks: { bookingId: string; staffId: string | null; start: string; end: string }[];
  gaps: { start: string; end: string }[]; // free time long enough for the shortest service
  lanes: { id: string; name: string }[]; // staff rows of the day ribbon ("" = unassigned); empty ⇒ single lane
  nextAfterToday: TodayBooking | null; // first confirmed booking after today
  insights: Record<string, TodayCustomerInsight>; // by customer_key
};
