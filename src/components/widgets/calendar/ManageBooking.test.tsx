import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManageBooking, type ManageBookingData } from "./ManageBooking";

const slot = { start: "2026-08-11T09:00:00.000Z", end: "2026-08-11T09:30:00.000Z" };

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: async () => body } as Response);
}

function makeInitial(overrides: Partial<ManageBookingData> = {}): ManageBookingData {
  return {
    service_name: "Haircut",
    service_id: "svc_1",
    location_id: null,
    instance_id: "inst_1",
    starts_at: "2026-08-10T09:00:00.000Z",
    status: "confirmed",
    business_name: "Acme Studio",
    business_username: "acme",
    timezone: "UTC",
    staff_name: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("ManageBooking", () => {
  it("renders the booking summary and a link back to the business", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<ManageBooking token="tok_1" initial={makeInitial()} />);

    expect(screen.getByText("Haircut")).toBeInTheDocument();
    expect(screen.getByText("with Acme Studio")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Back to Acme Studio" })).toHaveAttribute("href", "/acme");
  });

  it("shows the assigned staff member when present", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<ManageBooking token="tok_1" initial={makeInitial({ staff_name: "Alex" })} />);
    expect(screen.getByText("with Alex")).toBeInTheDocument();
  });

  it("shows the cancelled notice and no action buttons for an already-cancelled booking", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<ManageBooking token="tok_1" initial={makeInitial({ status: "cancelled" })} />);

    expect(screen.getByText("This booking has been cancelled.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reschedule" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("does nothing when the cancel confirmation is declined", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();

    render(<ManageBooking token="tok_1" initial={makeInitial()} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancels the booking on confirm and shows the cancelled notice", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ ok: true, status: "cancelled" }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(<ManageBooking token="tok_abc" initial={makeInitial()} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/widgets/bookings/tok_abc", { method: "DELETE" });
    await waitFor(() => expect(screen.getByText("This booking has been cancelled.")).toBeInTheDocument());
  });

  it("shows a generic error and stays in view mode when cancel fails", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ error: "nope" }, false));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(<ManageBooking token="tok_1" initial={makeInitial()} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.getByText("Could not cancel.")).toBeInTheDocument());
    expect(screen.getByText("Haircut")).toBeInTheDocument(); // still showing the (uncancelled) booking
  });

  it("opens the reschedule picker, commits a new slot, and returns to view mode with the updated time", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/availability")) return jsonResponse({ slots: [slot], service: { id: "svc_1" }, staff: [] });
      if (init?.method === "PATCH")
        return jsonResponse({ ok: true, starts_at: slot.start, ends_at: slot.end, staff_id: null, staff_name: null });
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ManageBooking token="tok_1" initial={makeInitial()} />);
    await user.click(screen.getByRole("button", { name: "Reschedule" }));

    expect(screen.getByText("Pick a new time")).toBeInTheDocument();
    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    await user.click(slotButton);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/widgets/bookings/tok_1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ starts_at: slot.start, staff_id: null }),
        })
      )
    );
    await waitFor(() => expect(screen.queryByText("Pick a new time")).not.toBeInTheDocument());
  });

  it("shows a reschedule error and stays in the picker on failure", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/availability")) return jsonResponse({ slots: [slot], service: { id: "svc_1" }, staff: [] });
      if (init?.method === "PATCH") return jsonResponse({ error: "That slot was just taken." }, false);
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ManageBooking token="tok_1" initial={makeInitial()} />);
    await user.click(screen.getByRole("button", { name: "Reschedule" }));
    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    await user.click(slotButton);

    await waitFor(() => expect(screen.getByText("Could not reschedule.")).toBeInTheDocument());
    expect(screen.getByText("Pick a new time")).toBeInTheDocument();
  });

  it("lets the user cancel out of the reschedule picker back to view mode", async () => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse({ slots: [], service: { id: "svc_1" }, staff: [] })));
    const user = userEvent.setup();

    render(<ManageBooking token="tok_1" initial={makeInitial()} />);
    await user.click(screen.getByRole("button", { name: "Reschedule" }));
    expect(screen.getByText("Pick a new time")).toBeInTheDocument();

    // The small text-only "Cancel" link inside the reschedule header closes the picker.
    const cancelLinks = screen.getAllByText("Cancel");
    await user.click(cancelLinks[cancelLinks.length - 1]);

    expect(screen.queryByText("Pick a new time")).not.toBeInTheDocument();
  });

  it("does not render a back-to-business link when business_username is null", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<ManageBooking token="tok_1" initial={makeInitial({ business_username: null })} />);
    expect(screen.queryByRole("link", { name: /Back to/ })).not.toBeInTheDocument();
  });
});
