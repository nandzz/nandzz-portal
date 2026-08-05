import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WidgetBookings, type WidgetBookingsData } from "./WidgetBookings";
import type { BookingRowData } from "./BookingRow";

// WidgetBookings' own logic (pagination/search/filtering) is what we're testing here,
// so BookingRow is replaced with a thin stand-in that exposes the props WidgetBookings
// passes it. BookingRow's own rendering/behavior is covered in BookingRow.test.tsx.
vi.mock("./BookingRow", () => ({
  BookingRow: ({
    b,
    cancellable,
    dim,
  }: {
    b: BookingRowData;
    cancellable?: boolean;
    dim?: boolean;
  }) => (
    <div data-testid="booking-row" data-cancellable={String(!!cancellable)} data-dim={String(!!dim)}>
      {b.customer_name}
    </div>
  ),
}));

const NOW = new Date("2026-08-10T12:00:00.000Z").getTime();
const FUTURE = "2026-08-10T13:00:00.000Z"; // > NOW → upcoming
const PAST = "2026-08-10T11:00:00.000Z"; // < NOW → past

function makeBooking(overrides: Partial<BookingRowData> = {}): BookingRowData {
  return {
    id: "bk_1",
    instance_id: "inst_1",
    service_id: "svc_1",
    customer_name: "Jane Doe",
    customer_email: "jane@example.com",
    service_name: "Haircut",
    starts_at: FUTURE,
    price_cents: 5000,
    status: "confirmed",
    customer_phone: null,
    manage_token: "token_1",
    staff_id: null,
    staff_name: null,
    ...overrides,
  };
}

function makeBookings(
  n: number,
  overrides: (i: number) => Partial<BookingRowData> = () => ({})
): BookingRowData[] {
  return Array.from({ length: n }, (_, i) =>
    makeBooking({ id: `bk_${i}`, customer_name: `Customer ${i}`, ...overrides(i) })
  );
}

function baseData(bookings: BookingRowData[]): WidgetBookingsData {
  return { timezone: "UTC", currencySymbol: "$", now: NOW, bookings };
}

describe("WidgetBookings", () => {
  describe("empty state", () => {
    it("renders the 'No bookings yet' message when there are no bookings", () => {
      render(<WidgetBookings data={baseData([])} />);
      expect(screen.getByText("No bookings yet")).toBeInTheDocument();
    });

    it("does not render the search box or filters when there are no bookings", () => {
      render(<WidgetBookings data={baseData([])} />);
      expect(screen.queryByPlaceholderText(/search bookings/i)).not.toBeInTheDocument();
    });
  });

  describe("pagination", () => {
    it("shows only PAGE_SIZE (12) rows on page 1 when there are more than 12 bookings", () => {
      render(<WidgetBookings data={baseData(makeBookings(15))} />);
      expect(screen.getAllByTestId("booking-row")).toHaveLength(12);
    });

    it("shows the correct range and page indicators on page 1", () => {
      render(<WidgetBookings data={baseData(makeBookings(15))} />);
      expect(screen.getByText("1–12 of 15")).toBeInTheDocument();
      expect(screen.getByText("1 / 2")).toBeInTheDocument();
    });

    it("disables Prev and enables Next on page 1", () => {
      render(<WidgetBookings data={baseData(makeBookings(15))} />);
      expect(screen.getByRole("button", { name: /prev/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
    });

    it("advances to page 2 on Next click, showing the remaining rows", async () => {
      const user = userEvent.setup();
      render(<WidgetBookings data={baseData(makeBookings(15))} />);

      await user.click(screen.getByRole("button", { name: /next/i }));

      expect(screen.getAllByTestId("booking-row")).toHaveLength(3);
      expect(screen.getByText("Customer 12")).toBeInTheDocument();
      expect(screen.getByText("Customer 13")).toBeInTheDocument();
      expect(screen.getByText("Customer 14")).toBeInTheDocument();
      expect(screen.getByText("13–15 of 15")).toBeInTheDocument();
      expect(screen.getByText("2 / 2")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /prev/i })).toBeEnabled();
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });

    it("goes back to page 1 on Prev click", async () => {
      const user = userEvent.setup();
      render(<WidgetBookings data={baseData(makeBookings(15))} />);

      await user.click(screen.getByRole("button", { name: /next/i }));
      await user.click(screen.getByRole("button", { name: /prev/i }));

      expect(screen.getAllByTestId("booking-row")).toHaveLength(12);
      expect(screen.getByText("1–12 of 15")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /prev/i })).toBeDisabled();
    });

    it("does not render pager controls when there are exactly 12 bookings", () => {
      render(<WidgetBookings data={baseData(makeBookings(12))} />);
      expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /prev/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/of 12/)).not.toBeInTheDocument();
    });

    it("does not render pager controls when there are fewer than 12 bookings", () => {
      render(<WidgetBookings data={baseData(makeBookings(3))} />);
      expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /prev/i })).not.toBeInTheDocument();
    });
  });

  describe("search", () => {
    it("filters by customer name (case-insensitive)", async () => {
      const bookings = [
        makeBooking({ id: "a", customer_name: "Alice Smith" }),
        makeBooking({ id: "b", customer_name: "Bob Jones" }),
      ];
      const user = userEvent.setup();
      render(<WidgetBookings data={baseData(bookings)} />);

      await user.type(screen.getByPlaceholderText(/search bookings/i), "alice");

      expect(screen.getAllByTestId("booking-row")).toHaveLength(1);
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    it("filters by customer email (case-insensitive)", async () => {
      const bookings = [
        makeBooking({ id: "a", customer_name: "Alice Smith", customer_email: "alice@example.com" }),
        makeBooking({ id: "b", customer_name: "Bob Jones", customer_email: "bob@example.com" }),
      ];
      const user = userEvent.setup();
      render(<WidgetBookings data={baseData(bookings)} />);

      await user.type(screen.getByPlaceholderText(/search bookings/i), "BOB@EXAMPLE");

      expect(screen.getAllByTestId("booking-row")).toHaveLength(1);
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    });

    it("filters by service name (case-insensitive)", async () => {
      const bookings = [
        makeBooking({ id: "a", customer_name: "Alice Smith", service_name: "Haircut" }),
        makeBooking({ id: "b", customer_name: "Bob Jones", service_name: "Massage" }),
      ];
      const user = userEvent.setup();
      render(<WidgetBookings data={baseData(bookings)} />);

      await user.type(screen.getByPlaceholderText(/search bookings/i), "massage");

      expect(screen.getAllByTestId("booking-row")).toHaveLength(1);
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    });

    it("shows the no-match message when nothing matches", async () => {
      const bookings = [makeBooking({ customer_name: "Alice Smith" })];
      const user = userEvent.setup();
      render(<WidgetBookings data={baseData(bookings)} />);

      await user.type(screen.getByPlaceholderText(/search bookings/i), "nobody");

      expect(screen.getByText("No bookings match your filters.")).toBeInTheDocument();
      expect(screen.queryByTestId("booking-row")).not.toBeInTheDocument();
    });

    it("resets to page 1 when searching from a later page", async () => {
      const bookings = makeBookings(15, (i) => ({
        customer_name: i === 14 ? "Zed Unique" : `Customer ${i}`,
      }));
      const user = userEvent.setup();
      render(<WidgetBookings data={baseData(bookings)} />);

      await user.click(screen.getByRole("button", { name: /next/i }));
      expect(screen.getByText("2 / 2")).toBeInTheDocument();

      await user.type(screen.getByPlaceholderText(/search bookings/i), "zed");

      expect(screen.getAllByTestId("booking-row")).toHaveLength(1);
      expect(screen.getByText("Zed Unique")).toBeInTheDocument();
      // Only one result remains, so the pager should be gone entirely — confirms the page reset.
      expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
    });
  });

  describe("status filters", () => {
    it("'All' shows every booking regardless of status/time", () => {
      const bookings = [
        makeBooking({ id: "1", starts_at: FUTURE, status: "confirmed" }),
        makeBooking({ id: "2", starts_at: PAST, status: "confirmed" }),
        makeBooking({ id: "3", starts_at: FUTURE, status: "cancelled" }),
      ];
      render(<WidgetBookings data={baseData(bookings)} />);
      expect(screen.getAllByTestId("booking-row")).toHaveLength(3);
    });

    it("'Upcoming' shows only confirmed bookings with starts_at >= now (boundary inclusive)", async () => {
      const bookings = [
        makeBooking({ id: "1", customer_name: "Future Confirmed", starts_at: FUTURE, status: "confirmed" }),
        makeBooking({ id: "2", customer_name: "Past Confirmed", starts_at: PAST, status: "confirmed" }),
        makeBooking({ id: "3", customer_name: "Future Cancelled", starts_at: FUTURE, status: "cancelled" }),
        makeBooking({
          id: "4",
          customer_name: "Exactly Now",
          starts_at: new Date(NOW).toISOString(),
          status: "confirmed",
        }),
      ];
      const user = userEvent.setup();
      render(<WidgetBookings data={baseData(bookings)} />);

      await user.click(screen.getByRole("button", { name: "Upcoming" }));

      const rows = screen.getAllByTestId("booking-row").map((r) => r.textContent);
      expect(rows.sort()).toEqual(["Exactly Now", "Future Confirmed"]);
    });

    it("'Past' shows only confirmed bookings with starts_at < now", async () => {
      const bookings = [
        makeBooking({ id: "1", customer_name: "Future Confirmed", starts_at: FUTURE, status: "confirmed" }),
        makeBooking({ id: "2", customer_name: "Past Confirmed", starts_at: PAST, status: "confirmed" }),
        makeBooking({ id: "3", customer_name: "Past Cancelled", starts_at: PAST, status: "cancelled" }),
      ];
      const user = userEvent.setup();
      render(<WidgetBookings data={baseData(bookings)} />);

      await user.click(screen.getByRole("button", { name: "Past" }));

      const rows = screen.getAllByTestId("booking-row");
      expect(rows).toHaveLength(1);
      expect(rows[0].textContent).toBe("Past Confirmed");
    });

    it("'Cancelled' shows only cancelled bookings regardless of time", async () => {
      const bookings = [
        makeBooking({ id: "1", customer_name: "Future Cancelled", starts_at: FUTURE, status: "cancelled" }),
        makeBooking({ id: "2", customer_name: "Past Cancelled", starts_at: PAST, status: "cancelled" }),
        makeBooking({ id: "3", customer_name: "Future Confirmed", starts_at: FUTURE, status: "confirmed" }),
      ];
      const user = userEvent.setup();
      render(<WidgetBookings data={baseData(bookings)} />);

      await user.click(screen.getByRole("button", { name: "Cancelled" }));

      const rows = screen.getAllByTestId("booking-row").map((r) => r.textContent);
      expect(rows.sort()).toEqual(["Future Cancelled", "Past Cancelled"]);
    });

    it("resets to page 1 when switching filters from a later page", async () => {
      const bookings = makeBookings(15, () => ({ starts_at: FUTURE, status: "confirmed" }));
      const user = userEvent.setup();
      render(<WidgetBookings data={baseData(bookings)} />);

      await user.click(screen.getByRole("button", { name: /next/i }));
      expect(screen.getByText("2 / 2")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Upcoming" }));

      expect(screen.getByText("1–12 of 15")).toBeInTheDocument();
    });
  });

  describe("row rendering", () => {
    it("marks upcoming confirmed bookings as cancellable and not dimmed", () => {
      const bookings = [makeBooking({ id: "1", starts_at: FUTURE, status: "confirmed" })];
      render(<WidgetBookings data={baseData(bookings)} />);
      const row = screen.getByTestId("booking-row");
      expect(row).toHaveAttribute("data-cancellable", "true");
      expect(row).toHaveAttribute("data-dim", "false");
    });

    it("marks past confirmed bookings as dimmed and not cancellable", () => {
      const bookings = [makeBooking({ id: "1", starts_at: PAST, status: "confirmed" })];
      render(<WidgetBookings data={baseData(bookings)} />);
      const row = screen.getByTestId("booking-row");
      expect(row).toHaveAttribute("data-cancellable", "false");
      expect(row).toHaveAttribute("data-dim", "true");
    });

    it("marks cancelled bookings as dimmed and not cancellable even if in the future", () => {
      const bookings = [makeBooking({ id: "1", starts_at: FUTURE, status: "cancelled" })];
      render(<WidgetBookings data={baseData(bookings)} />);
      const row = screen.getByTestId("booking-row");
      expect(row).toHaveAttribute("data-cancellable", "false");
      expect(row).toHaveAttribute("data-dim", "true");
    });
  });
});
