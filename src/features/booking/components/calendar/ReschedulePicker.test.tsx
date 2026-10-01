import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReschedulePicker } from "./ReschedulePicker";

// The picker fetches /reschedule-context (staff choice), then /slots (scoped to
// the chosen staff), then commits a slot + staff map — mirroring the booking
// flow. No specialist choice ⇒ it skips straight to the time grid.
const slot = { start: "2026-08-10T09:00:00.000Z", end: "2026-08-10T09:30:00.000Z" };

const alex = { id: "st_a", name: "Alex", photo_url: null, info: null };
const bella = { id: "st_b", name: "Bella", photo_url: null, info: null };

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: async () => body } as Response);
}

// Wire a fetch mock that answers context + slots by URL.
function setupFetch(opts: { context?: unknown; contextOk?: boolean; slots?: unknown[]; slotsOk?: boolean } = {}) {
  const {
    context = { services: [], needs_staff_step: false },
    contextOk = true,
    slots = [slot],
    slotsOk = true,
  } = opts;
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/reschedule-context")) return jsonResponse(context, contextOk);
    if (url.includes("/slots")) return jsonResponse({ timezone: "UTC", slots }, slotsOk);
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("ReschedulePicker", () => {
  it("skips the staff step and shows times when no service has a real staff choice", async () => {
    setupFetch();
    render(<ReschedulePicker token="tok_1" timezone="UTC" onPick={vi.fn()} />);
    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    expect(slotButton).toBeInTheDocument();
    expect(screen.queryByText("Any available")).not.toBeInTheDocument();
  });

  it("commits the picked slot with the (preserved) staff map", async () => {
    setupFetch();
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<ReschedulePicker token="tok_1" timezone="UTC" onPick={onPick} />);
    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    await user.click(slotButton);
    expect(onPick).toHaveBeenCalledWith(slot, {});
  });

  it("shows the per-service staff step first when a service has 2+ eligible staff", async () => {
    setupFetch({
      context: {
        services: [{ service_id: "svc_1", name: "Haircut", current_staff_id: "st_a", eligible_staff: [alex, bella] }],
        needs_staff_step: true,
      },
    });
    render(<ReschedulePicker token="tok_1" timezone="UTC" onPick={vi.fn()} />);

    // Staff step (not the time grid) shows first.
    expect(await screen.findByText("Any available")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Bella")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /9:00/ })).not.toBeInTheDocument();
  });

  it("commits with the chosen per-service staff after the staff step", async () => {
    const fetchMock = setupFetch({
      context: {
        services: [{ service_id: "svc_1", name: "Haircut", current_staff_id: "st_a", eligible_staff: [alex, bella] }],
        needs_staff_step: true,
      },
    });
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<ReschedulePicker token="tok_1" timezone="UTC" onPick={onPick} />);

    await screen.findByText("Bella");
    await user.click(screen.getByText("Bella"));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    // The slots request carries the chosen staff.
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes("/slots") && String(url).includes("svc_1%3Ast_b"))
      ).toBe(true)
    );
    await user.click(slotButton);
    expect(onPick).toHaveBeenCalledWith(slot, { svc_1: "st_b" });
  });

  it("shows the load error when /slots fails", async () => {
    setupFetch({ slotsOk: false });
    render(<ReschedulePicker token="tok_1" timezone="UTC" onPick={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Could not load availability.")).toBeInTheDocument());
  });

  it("shows the no-slots message when there are no open slots", async () => {
    setupFetch({ slots: [] });
    render(<ReschedulePicker token="tok_1" timezone="UTC" onPick={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText("No open slots in the next 60 days.")).toBeInTheDocument()
    );
  });

  it("surfaces the parent-owned commit error alongside the time grid", async () => {
    setupFetch();
    render(
      <ReschedulePicker
        token="tok_1"
        timezone="UTC"
        error="That slot was just taken. Please pick another."
        onPick={vi.fn()}
      />
    );
    await screen.findByRole("button", { name: /9:00/ });
    expect(screen.getByText("That slot was just taken. Please pick another.")).toBeInTheDocument();
  });
});
