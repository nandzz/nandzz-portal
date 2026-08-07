import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReschedulePicker } from "./ReschedulePicker";

const slotNoStaff = { start: "2026-08-10T09:00:00.000Z", end: "2026-08-10T09:30:00.000Z" };
const slotWithStaff = {
  start: "2026-08-10T09:00:00.000Z",
  end: "2026-08-10T09:30:00.000Z",
  staff_ids: ["st_a", "st_b"],
};
const service = { id: "svc_1", name: "Haircut", duration_min: 30 };
const staffA = { id: "st_a", name: "Alex", availability: {} };
const staffB = { id: "st_b", name: "Bella", availability: {} };

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: async () => body } as Response);
}

function setupFetch(body: unknown, ok = true) {
  const fetchMock = vi.fn((_input: RequestInfo | URL) => jsonResponse(body, ok));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("ReschedulePicker", () => {
  it("shows a loading skeleton, then the load error message when the fetch fails", async () => {
    setupFetch(null, false);
    render(
      <ReschedulePicker instanceId="inst_1" serviceId="svc_1" locationId={null} timezone="UTC" onPick={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByText("Could not load availability.")).toBeInTheDocument());
  });

  it("shows the load error message when fetch throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ReschedulePicker instanceId="inst_1" serviceId="svc_1" locationId={null} timezone="UTC" onPick={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByText("Could not load availability.")).toBeInTheDocument());
  });

  it("shows the no-slots message when there are no open slots", async () => {
    setupFetch({ slots: [], service, staff: [] });
    render(
      <ReschedulePicker instanceId="inst_1" serviceId="svc_1" locationId={null} timezone="UTC" onPick={vi.fn()} />
    );
    await waitFor(() =>
      expect(screen.getByText("No open slots in the next 60 days.")).toBeInTheDocument()
    );
  });

  it("requests availability for the given service/location", async () => {
    const fetchMock = setupFetch({ slots: [slotNoStaff], service, staff: [] });
    render(
      <ReschedulePicker
        instanceId="inst_1"
        serviceId="svc_1"
        locationId="loc_1"
        timezone="UTC"
        onPick={vi.fn()}
      />
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toBe(
      "/api/widgets/inst_1/availability?service_id=svc_1&days=60&location_id=loc_1"
    );
  });

  it("commits immediately with staffId '' when the picked slot has no eligible free staff", async () => {
    setupFetch({ slots: [slotNoStaff], service, staff: [] });
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(
      <ReschedulePicker instanceId="inst_1" serviceId="svc_1" locationId={null} timezone="UTC" onPick={onPick} />
    );

    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    await user.click(slotButton);

    expect(onPick).toHaveBeenCalledWith(slotNoStaff, "");
  });

  it("shows the specialist step for a slot with eligible free staff instead of committing immediately", async () => {
    setupFetch({ slots: [slotWithStaff], service, staff: [staffA, staffB] });
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(
      <ReschedulePicker instanceId="inst_1" serviceId="svc_1" locationId={null} timezone="UTC" onPick={onPick} />
    );

    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    await user.click(slotButton);

    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByText("Choose your specialist")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Bella")).toBeInTheDocument();
  });

  it("commits with the chosen staff id from the specialist step", async () => {
    setupFetch({ slots: [slotWithStaff], service, staff: [staffA, staffB] });
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(
      <ReschedulePicker instanceId="inst_1" serviceId="svc_1" locationId={null} timezone="UTC" onPick={onPick} />
    );

    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    await user.click(slotButton);
    await user.click(screen.getByText("Alex"));

    expect(onPick).toHaveBeenCalledWith(slotWithStaff, "st_a");
  });

  it("commits with '' from the specialist step's 'Any available' option", async () => {
    setupFetch({ slots: [slotWithStaff], service, staff: [staffA, staffB] });
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(
      <ReschedulePicker instanceId="inst_1" serviceId="svc_1" locationId={null} timezone="UTC" onPick={onPick} />
    );

    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    await user.click(slotButton);
    await user.click(screen.getByText("Any available"));

    expect(onPick).toHaveBeenCalledWith(slotWithStaff, "");
  });

  it("lets the user back out of the specialist step to the time picker", async () => {
    setupFetch({ slots: [slotWithStaff], service, staff: [staffA, staffB] });
    const user = userEvent.setup();
    render(
      <ReschedulePicker instanceId="inst_1" serviceId="svc_1" locationId={null} timezone="UTC" onPick={vi.fn()} />
    );

    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    await user.click(slotButton);
    expect(screen.getByText("Choose your specialist")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByText("Choose your specialist")).not.toBeInTheDocument();
  });

  it("surfaces the parent-owned commit error alongside the time grid", async () => {
    setupFetch({ slots: [slotNoStaff], service, staff: [] });
    render(
      <ReschedulePicker
        instanceId="inst_1"
        serviceId="svc_1"
        locationId={null}
        timezone="UTC"
        error="That slot was just taken. Please pick another."
        onPick={vi.fn()}
      />
    );
    await screen.findByRole("button", { name: /9:00/ });
    expect(screen.getByText("That slot was just taken. Please pick another.")).toBeInTheDocument();
  });
});
