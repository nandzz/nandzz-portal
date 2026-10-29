import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WidgetBookings, type ManualBookingScope } from "./WidgetBookings";
import type { BookingRowData } from "./BookingRow";
import type { CalendarData, ListData, BookingsFilter } from "@/features/booking/dashboardTypes";

// WidgetBookings is now a controlled presentational component: filtering,
// searching, ordering and pagination happen server-side (fetchListData) and the
// parent feeds it one page + a month of calendar rows. These tests cover what
// the component itself still owns — rendering the given page, pager math, the
// empty state, and firing the parent callbacks.

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

vi.mock("./BookingRow", () => ({
  BookingRow: ({ b, cancellable }: { b: BookingRowData; cancellable?: boolean }) => (
    <div data-testid="booking-row" data-cancellable={String(!!cancellable)}>
      {b.customer_name}
    </div>
  ),
}));

const manualScope: ManualBookingScope = {
  instanceId: "inst_1",
  locationId: null,
  services: [],
  categories: [],
  staff: [],
  showPrices: true,
};

const NOW = new Date("2026-08-10T12:00:00.000Z").getTime();
const FUTURE = "2026-08-10T13:00:00.000Z";
const PAST = "2026-08-10T11:00:00.000Z";

function makeBooking(overrides: Partial<BookingRowData> = {}): BookingRowData {
  return {
    id: "bk_1",
    instance_id: "inst_1",
    service_id: "svc_1",
    customer_name: "Jane Doe",
    customer_email: "jane@example.com",
    service_name: "Haircut",
    starts_at: FUTURE,
    ends_at: "2026-08-10T13:30:00.000Z",
    price_cents: 5000,
    status: "confirmed",
    customer_phone: null,
    manage_token: "token_1",
    staff_id: null,
    staff_name: null,
    location_id: null,
    ...overrides,
  };
}

const emptyCalendar: CalendarData = {
  monthKey: "2026-08",
  bookings: [],
};

function renderBookings(over: {
  list?: ListData;
  calendar?: CalendarData;
  page?: number;
  filter?: BookingsFilter;
  query?: string;
  onPageChange?: (p: number) => void;
  onFilterChange?: (f: BookingsFilter) => void;
  onQueryChange?: (q: string) => void;
  onMonthChange?: (m: string) => void;
} = {}) {
  const handlers = {
    onPageChange: over.onPageChange ?? vi.fn(),
    onFilterChange: over.onFilterChange ?? vi.fn(),
    onQueryChange: over.onQueryChange ?? vi.fn(),
    onMonthChange: over.onMonthChange ?? vi.fn(),
  };
  render(
    <WidgetBookings
      timezone="UTC"
      currencySymbol="$"
      now={NOW}
      calendar={over.calendar ?? emptyCalendar}
      monthKey="2026-08"
      onMonthChange={handlers.onMonthChange}
      calendarLoading={false}
      list={over.list ?? { bookings: [], total: 0 }}
      page={over.page ?? 0}
      onPageChange={handlers.onPageChange}
      listLoading={false}
      filter={over.filter ?? "all"}
      onFilterChange={handlers.onFilterChange}
      query={over.query ?? ""}
      onQueryChange={handlers.onQueryChange}
      manual={manualScope}
      onBooked={vi.fn()}
    />
  );
  return handlers;
}

describe("WidgetBookings (controlled)", () => {
  describe("empty state", () => {
    it("shows 'No bookings yet' only in the neutral view (all + no query + total 0)", () => {
      renderBookings({ list: { bookings: [], total: 0 }, filter: "all", query: "" });
      expect(screen.getByText("No bookings yet")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/search bookings/i)).not.toBeInTheDocument();
    });

    it("shows the no-match message (not the empty state) when a filter yields nothing", () => {
      renderBookings({ list: { bookings: [], total: 0 }, filter: "cancelled" });
      expect(screen.queryByText("No bookings yet")).not.toBeInTheDocument();
      expect(screen.getByText("No bookings match your filters.")).toBeInTheDocument();
    });
  });

  describe("list rendering", () => {
    it("renders exactly the server-provided page rows (no client slicing)", () => {
      const bookings = Array.from({ length: 12 }, (_, i) =>
        makeBooking({ id: `bk_${i}`, customer_name: `Customer ${i}` })
      );
      renderBookings({ list: { bookings, total: 40 } });
      expect(screen.getAllByTestId("booking-row")).toHaveLength(12);
    });

    it("marks upcoming confirmed rows cancellable and past/cancelled rows not", () => {
      const bookings = [
        makeBooking({ id: "1", customer_name: "Up", starts_at: FUTURE, status: "confirmed" }),
        makeBooking({ id: "2", customer_name: "Past", starts_at: PAST, status: "confirmed" }),
        makeBooking({ id: "3", customer_name: "Canc", starts_at: FUTURE, status: "cancelled" }),
      ];
      renderBookings({ list: { bookings, total: 3 } });
      const rows = screen.getAllByTestId("booking-row");
      expect(rows.find((r) => r.textContent === "Up")).toHaveAttribute("data-cancellable", "true");
      expect(rows.find((r) => r.textContent === "Past")).toHaveAttribute("data-cancellable", "false");
      expect(rows.find((r) => r.textContent === "Canc")).toHaveAttribute("data-cancellable", "false");
    });
  });

  describe("pager", () => {
    it("hides the pager when total ≤ PAGE_SIZE", () => {
      const bookings = Array.from({ length: 12 }, (_, i) => makeBooking({ id: `b${i}`, customer_name: `C${i}` }));
      renderBookings({ list: { bookings, total: 12 } });
      expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
    });

    it("shows range/page indicators derived from total, offset and page rows", () => {
      const bookings = Array.from({ length: 12 }, (_, i) => makeBooking({ id: `b${i}`, customer_name: `C${i}` }));
      renderBookings({ list: { bookings, total: 40 }, page: 0 });
      expect(screen.getByText("1–12 of 40")).toBeInTheDocument();
      expect(screen.getByText("1 / 4")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /prev/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
    });

    it("computes the range for a middle page from the page prop", () => {
      const bookings = Array.from({ length: 12 }, (_, i) => makeBooking({ id: `b${i}`, customer_name: `C${i}` }));
      renderBookings({ list: { bookings, total: 40 }, page: 1 });
      expect(screen.getByText("13–24 of 40")).toBeInTheDocument();
      expect(screen.getByText("2 / 4")).toBeInTheDocument();
    });

    it("calls onPageChange when paging", async () => {
      const user = userEvent.setup();
      const bookings = Array.from({ length: 12 }, (_, i) => makeBooking({ id: `b${i}`, customer_name: `C${i}` }));
      const onPageChange = vi.fn();
      renderBookings({ list: { bookings, total: 40 }, page: 0, onPageChange });
      await user.click(screen.getByRole("button", { name: /next/i }));
      expect(onPageChange).toHaveBeenCalledWith(1);
    });
  });

  describe("toolbar callbacks", () => {
    it("fires onFilterChange when a status pill is clicked", async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();
      renderBookings({ list: { bookings: [makeBooking()], total: 1 }, onFilterChange });
      await user.click(screen.getByRole("button", { name: "Upcoming" }));
      expect(onFilterChange).toHaveBeenCalledWith("upcoming");
    });

    it("fires onQueryChange as the owner types", async () => {
      const user = userEvent.setup();
      const onQueryChange = vi.fn();
      renderBookings({ list: { bookings: [makeBooking()], total: 1 }, onQueryChange });
      await user.type(screen.getByPlaceholderText(/search bookings/i), "a");
      expect(onQueryChange).toHaveBeenCalledWith("a");
    });
  });
});
