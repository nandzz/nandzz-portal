import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WidgetToday } from "./WidgetToday";
import type { TodayBooking, TodayCustomerInsight, TodayData } from "@/features/booking/dashboardTypes";

// Monday 2026-10-05, 11:00 UTC. Only Date is faked so React/user-event timers
// keep running normally.
const NOW = "2026-10-05T11:00:00Z";

const iso = (hhmm: string, day = "2026-10-05") => new Date(`${day}T${hhmm}:00Z`).toISOString();

function booking(id: string, name: string, start: string, end: string, patch: Partial<TodayBooking> = {}): TodayBooking {
  return {
    id,
    instance_id: "inst_1",
    service_id: "svc_1",
    customer_name: name,
    customer_email: `${id}@example.com`,
    service_name: "Nails",
    starts_at: iso(start),
    ends_at: iso(end),
    price_cents: 4000,
    status: "confirmed",
    customer_phone: null,
    staff_id: null,
    staff_name: null,
    services: null,
    location_id: null,
    manage_token: `tok_${id}`,
    notes: null,
    customer_profile: null,
    customer_key: `${id}@example.com`,
    ...patch,
  };
}

function insight(patch: Partial<TodayCustomerInsight> = {}): TodayCustomerInsight {
  return {
    pastVisits: 0,
    spentCents: 0,
    cancelled: 0,
    firstVisit: null,
    lastVisit: null,
    nextVisit: null,
    avgGapDays: null,
    topServices: [],
    topStaff: null,
    usualDaypart: null,
    usualWeekday: null,
    notes: [],
    recent: [],
    ...patch,
  };
}

const alice = booking("alice", "Alice Bianchi", "09:00", "10:00");
const bruno = booking("bruno", "Bruno Verdi", "10:30", "11:30");
const carla = booking("carla", "Carla Rossi", "13:00", "14:00", { notes: "Bring reference photos" });
const dan = booking("dan", "Dan Neri", "15:00", "15:30", { status: "cancelled" });

function dayData(patch: Partial<TodayData> = {}): TodayData {
  return {
    date: "2026-10-05",
    timezone: "UTC",
    currencySymbol: "€",
    bookings: [alice, bruno, carla, dan],
    hours: [{ start: iso("09:00"), end: iso("17:00") }],
    openMin: 480,
    bookedMin: 180,
    blocks: [alice, bruno, carla].map((b) => ({ bookingId: b.id, staffId: null, start: b.starts_at, end: b.ends_at })),
    gaps: [
      { start: iso("10:00"), end: iso("10:30") },
      { start: iso("11:30"), end: iso("13:00") },
      { start: iso("14:00"), end: iso("17:00") },
    ],
    lanes: [],
    nextAfterToday: null,
    insights: {
      "alice@example.com": insight({ pastVisits: 4 }),
      "bruno@example.com": insight({
        pastVisits: 2,
        spentCents: 8000,
        lastVisit: iso("10:00", "2026-09-21"),
        topServices: [{ name: "Nails", count: 3 }],
        usualDaypart: "morning",
        usualWeekday: 0,
      }),
      "carla@example.com": insight(),
    },
    ...patch,
  };
}

describe("WidgetToday", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("summarizes the day and focuses the appointment in progress", () => {
    render(<WidgetToday data={dayData()} loading={false} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/Monday, October 5/);
    expect(screen.getByText(/2 appointments still to go, the last at/)).toBeInTheDocument();

    // Three confirmed (cancelled excluded), one completed; revenue of confirmed only.
    expect(screen.getByText("Appointments").nextElementSibling).toHaveTextContent("3");
    expect(screen.getByText("1 completed")).toBeInTheDocument();
    expect(screen.getByText("Today's revenue").nextElementSibling).toHaveTextContent("€120");
    expect(screen.getByText("€40 already earned")).toBeInTheDocument();
    expect(screen.getByText("Occupancy").nextElementSibling).toHaveTextContent("38%");
    // Free from now on: 11:30–13:00 + 14:00–17:00 (the 10:00 gap is past).
    expect(screen.getByText("Free time").nextElementSibling).toHaveTextContent("4h 30m");

    const panel = screen.getByRole("region", { name: /In progress now/ });
    expect(within(panel).getByText("Bruno Verdi")).toBeInTheDocument();
    expect(within(panel).getByText("Visit #3")).toBeInTheDocument();
    expect(within(panel).getByText("Monday, in the morning")).toBeInTheDocument();
    expect(within(panel).getByText(/No next visit booked yet/)).toBeInTheDocument();
  });

  it("lists what's left with free time between, folding completed and cancelled away", async () => {
    const user = userEvent.setup();
    render(<WidgetToday data={dayData()} loading={false} />);
    const agenda = screen.getByRole("region", { name: "Agenda" });

    expect(within(agenda).queryByText("Alice Bianchi")).not.toBeInTheDocument();
    expect(within(agenda).getByText(/Free for 1h 30m/)).toBeInTheDocument();
    expect(within(agenda).getByText(/Free for 3h/)).toBeInTheDocument();
    expect(within(agenda).queryByText(/Free for 30 min/)).not.toBeInTheDocument();

    await user.click(within(agenda).getByRole("button", { name: /Show 1 completed/ }));
    expect(within(agenda).getByText("Alice Bianchi")).toBeInTheDocument();

    expect(within(agenda).queryByText("Dan Neri")).not.toBeInTheDocument();
    await user.click(within(agenda).getByRole("button", { name: /1 cancelled today/ }));
    expect(within(agenda).getByText("Dan Neri")).toBeInTheDocument();
  });

  it("shows a picked appointment's customer history in the focus panel", async () => {
    const user = userEvent.setup();
    render(<WidgetToday data={dayData()} loading={false} />);
    const agenda = screen.getByRole("region", { name: "Agenda" });

    const carlaRow = within(agenda).getByRole("button", { name: /Carla Rossi/ });
    expect(within(carlaRow).getByText("New customer")).toBeInTheDocument();
    await user.click(carlaRow);

    const panel = screen.getByRole("region", { name: "Selected appointment" });
    expect(within(panel).getByText("Carla Rossi")).toBeInTheDocument();
    expect(within(panel).getByText("Bring reference photos")).toBeInTheDocument();
    expect(within(panel).getByText(/This is Carla's first visit/)).toBeInTheDocument();
  });

  it("selects an appointment from its block on the day ribbon", async () => {
    const user = userEvent.setup();
    render(<WidgetToday data={dayData()} loading={false} />);

    await user.click(screen.getByRole("button", { name: /–.*Alice Bianchi/ }));
    expect(screen.getByRole("region", { name: "Completed" })).toHaveTextContent("Alice Bianchi");
  });

  it("points to the next appointment on a closed day", () => {
    const next = booking("eva", "Eva Gallo", "09:30", "10:00");
    render(
      <WidgetToday
        data={dayData({
          bookings: [],
          hours: [],
          openMin: 0,
          bookedMin: 0,
          blocks: [],
          gaps: [],
          nextAfterToday: { ...next, starts_at: iso("09:30", "2026-10-06"), ends_at: iso("10:00", "2026-10-06") },
          insights: { "eva@example.com": insight({ pastVisits: 1 }) },
        })}
        loading={false}
      />
    );

    expect(screen.getByText(/You're closed today\. Next appointment: tomorrow/)).toBeInTheDocument();
    const panel = screen.getByRole("region", { name: "Next appointment" });
    expect(within(panel).getByText("Eva Gallo")).toBeInTheDocument();
    expect(within(panel).getByText(/tomorrow/)).toBeInTheDocument();
  });
});
