import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarBookingFlow } from "./CalendarBookingFlow";
import type { CalendarService, Location, StaffMember } from "@/lib/types";

const service: CalendarService = { id: "svc_1", name: "Haircut", duration_min: 30, price_cents: 4000 };
const service2: CalendarService = { id: "svc_2", name: "Color", duration_min: 60 };

const slotNoStaff = { start: "2026-08-10T09:00:00.000Z", end: "2026-08-10T09:30:00.000Z" };
const staffA: StaffMember = { id: "st_a", name: "Alex", availability: {} };
const staffB: StaffMember = { id: "st_b", name: "Bella", availability: {} };
const slotWithStaff = {
  start: "2026-08-10T09:00:00.000Z",
  end: "2026-08-10T09:30:00.000Z",
  staff_ids: ["st_a", "st_b"],
};

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: async () => body } as Response);
}

function setupFetch(opts: { slots?: unknown[]; bookOk?: boolean; bookBody?: unknown } = {}) {
  const { slots = [slotNoStaff], bookOk = true, bookBody } = opts;
  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/availability")) {
      return jsonResponse({ slots });
    }
    if (url.endsWith("/book")) {
      return jsonResponse(bookBody ?? { manage_url: "https://nandzz.com/booking/tok_1", booking: {} }, bookOk);
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function fillDetailsAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("Full name"), "Jamie Rivera");
  await user.type(screen.getByPlaceholderText("Email (optional)"), "jamie@example.com");
  await user.type(screen.getByPlaceholderText("Phone"), "+15551234567");
  await user.click(screen.getByRole("button", { name: "Confirm booking" }));
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("CalendarBookingFlow — legacy single-location mode", () => {
  it("starts on the service step and lists the given services", () => {
    setupFetch();
    render(
      <CalendarBookingFlow
        instanceId="inst_1"
        services={[service, service2]}
        timezone="UTC"
        businessName="Acme"
      />
    );
    expect(screen.getByText("Choose a service")).toBeInTheDocument();
    expect(screen.getByText("Haircut")).toBeInTheDocument();
    expect(screen.getByText("Color")).toBeInTheDocument();
    expect(screen.getByText("$40.00")).toBeInTheDocument();
  });

  it("fetches availability scoped to the picked service on selection", async () => {
    const fetchMock = setupFetch();
    const user = userEvent.setup();
    render(<CalendarBookingFlow instanceId="inst_1" services={[service]} timezone="UTC" businessName="Acme" />);

    await user.click(screen.getByText("Haircut"));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [calledUrl] = fetchMock.mock.calls[0];
    // The per-service staff map rides along as `staff=svcId:staffId` pairs; an
    // unstaffed service sends an empty choice (`svc_1:`).
    expect(String(calledUrl)).toBe(
      "/api/widgets/inst_1/availability?service_ids=svc_1&days=60&staff=svc_1%3A"
    );
  });

  it("skips the specialist step and goes straight to details for a single-resource (unstaffed) slot", async () => {
    setupFetch({ slots: [slotNoStaff] });
    const user = userEvent.setup();
    render(<CalendarBookingFlow instanceId="inst_1" services={[service]} timezone="UTC" businessName="Acme" />);

    await user.click(screen.getByText("Haircut"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    await user.click(slotButton);

    expect(screen.getByText("Your details")).toBeInTheDocument();
    expect(screen.queryByText("Choose your specialist")).not.toBeInTheDocument();
  });

  it("shows the specialist step FIRST (before day/time) when 2+ staff are eligible, then proceeds", async () => {
    setupFetch({ slots: [slotWithStaff] });
    const user = userEvent.setup();
    render(
      <CalendarBookingFlow
        instanceId="inst_1"
        services={[service]}
        staff={[staffA, staffB]}
        timezone="UTC"
        businessName="Acme"
      />
    );

    await user.click(screen.getByText("Haircut"));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // Staff step is shown before any day/time is picked.
    expect(screen.getByText("Choose your specialist")).toBeInTheDocument();
    expect(screen.getByText("Any available")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Bella")).toBeInTheDocument();
    // No time slots yet — availability is only loaded after the staff step.
    expect(screen.queryByRole("button", { name: /9:00/ })).not.toBeInTheDocument();

    // Pick a specialist for the service, then continue to day/time.
    await user.click(screen.getByText("Alex"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    await user.click(slotButton);

    expect(screen.getByText("Your details")).toBeInTheDocument();
    // The booking summary now lists the specialist as its own labeled row.
    expect(screen.getByText("Specialist")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("scopes the availability request to the chosen specialist (per-service staff map)", async () => {
    const fetchMock = setupFetch({ slots: [slotWithStaff] });
    const user = userEvent.setup();
    render(
      <CalendarBookingFlow
        instanceId="inst_1"
        services={[service]}
        staff={[staffA, staffB]}
        timezone="UTC"
        businessName="Acme"
      />
    );

    await user.click(screen.getByText("Haircut"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByText("Alex"));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const availCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/availability"))!;
    // svc_1 pinned to st_a: `staff=svc_1:st_a` (colon percent-encoded).
    expect(String(availCall[0])).toContain("staff=svc_1%3Ast_a");
  });

  it("shows the sole eligible specialist pre-assigned (no choice) when only one staff qualifies", async () => {
    // svc_a is restricted to staffA, so with two staff only one is eligible ⇒
    // the specialist step just tells the visitor who'll do it (no "Any" / no
    // alternatives), and availability is pinned to that specialist.
    const svcRestricted: CalendarService = { id: "svc_a", name: "Shave", duration_min: 20, staff_ids: ["st_a"] };
    const fetchMock = setupFetch({ slots: [slotNoStaff] });
    const user = userEvent.setup();
    render(
      <CalendarBookingFlow
        instanceId="inst_1"
        services={[svcRestricted]}
        staff={[staffA, staffB]}
        timezone="UTC"
        businessName="Acme"
      />
    );

    await user.click(screen.getByText("Shave"));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Alex")).toBeInTheDocument();
    expect(screen.queryByText("Bella")).not.toBeInTheDocument();
    expect(screen.queryByText("Any available")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("button", { name: /9:00/ });
    const availCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/availability"))!;
    expect(String(availCall[0])).toContain("staff=svc_a%3Ast_a");
  });

  it("submits 'any available' (empty per-service choice) when that option is chosen", async () => {
    const fetchMock = setupFetch({ slots: [slotWithStaff] });
    const user = userEvent.setup();
    render(
      <CalendarBookingFlow
        instanceId="inst_1"
        services={[service]}
        staff={[staffA, staffB]}
        timezone="UTC"
        businessName="Acme"
      />
    );

    await user.click(screen.getByText("Haircut"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    // "Any available" is the default; pick it explicitly, then continue.
    await user.click(screen.getByText("Any available"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    await user.click(slotButton);
    await fillDetailsAndSubmit(user);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/book"), expect.anything()));
    const bookCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/book"))!;
    const body = JSON.parse((bookCall[1] as RequestInit).body as string);
    expect(body.staff_by_service).toEqual({ svc_1: "" });
  });

  it("validates required fields before submitting", async () => {
    setupFetch({ slots: [slotNoStaff] });
    const user = userEvent.setup();
    render(<CalendarBookingFlow instanceId="inst_1" services={[service]} timezone="UTC" businessName="Acme" />);

    await user.click(screen.getByText("Haircut"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    await user.click(slotButton);
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Name and phone are required.");
  });

  it("submits the booking and shows the confirmation step, firing onBooked", async () => {
    setupFetch({ slots: [slotNoStaff], bookBody: { manage_url: "https://nandzz.com/booking/tok_9" } });
    const onBooked = vi.fn();
    const user = userEvent.setup();
    render(
      <CalendarBookingFlow
        instanceId="inst_1"
        services={[service]}
        timezone="UTC"
        businessName="Acme"
        onBooked={onBooked}
      />
    );

    await user.click(screen.getByText("Haircut"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    await user.click(slotButton);
    await fillDetailsAndSubmit(user);

    await waitFor(() => expect(screen.getByText("You're booked!")).toBeInTheDocument());
    expect(onBooked).toHaveBeenCalledWith("https://nandzz.com/booking/tok_9");
    expect(screen.getByRole("link", { name: "Manage your booking" })).toHaveAttribute(
      "href",
      "https://nandzz.com/booking/tok_9"
    );
  });

  it("shows the mapped, translated error for a known server error code", async () => {
    setupFetch({ slots: [slotNoStaff], bookOk: false, bookBody: { error: "SLOT_TAKEN" } });
    const user = userEvent.setup();
    render(<CalendarBookingFlow instanceId="inst_1" services={[service]} timezone="UTC" businessName="Acme" />);

    await user.click(screen.getByText("Haircut"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    await user.click(slotButton);
    await fillDetailsAndSubmit(user);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("That slot was just booked. Please pick another.")
    );
  });

  it("shows the generic error for an unrecognized server error code", async () => {
    setupFetch({ slots: [slotNoStaff], bookOk: false, bookBody: { error: "SOMETHING_NEW" } });
    const user = userEvent.setup();
    render(<CalendarBookingFlow instanceId="inst_1" services={[service]} timezone="UTC" businessName="Acme" />);

    await user.click(screen.getByText("Haircut"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    await user.click(slotButton);
    await fillDetailsAndSubmit(user);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Could not complete the booking. Please try again.")
    );
  });

  it("navigates back to the service step from the slot step", async () => {
    setupFetch({ slots: [slotNoStaff] });
    const user = userEvent.setup();
    render(<CalendarBookingFlow instanceId="inst_1" services={[service]} timezone="UTC" businessName="Acme" />);

    await user.click(screen.getByText("Haircut"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("button", { name: /9:00/ });
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText("Choose a service")).toBeInTheDocument();
  });

  it("navigates back through slot → staff → service in the staffed flow", async () => {
    setupFetch({ slots: [slotWithStaff] });
    const user = userEvent.setup();
    render(
      <CalendarBookingFlow
        instanceId="inst_1"
        services={[service]}
        staff={[staffA, staffB]}
        timezone="UTC"
        businessName="Acme"
      />
    );

    await user.click(screen.getByText("Haircut"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByText("Alex"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("button", { name: /9:00/ });

    // slot → staff
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Choose your specialist")).toBeInTheDocument();
    // staff → service
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Choose a service")).toBeInTheDocument();
  });

  it("selects multiple services, sums the duration, and books all of them", async () => {
    const fetchMock = setupFetch({ slots: [slotNoStaff] });
    const user = userEvent.setup();
    render(
      <CalendarBookingFlow
        instanceId="inst_1"
        services={[service, service2]}
        timezone="UTC"
        businessName="Acme"
      />
    );

    await user.click(screen.getByText("Haircut"));
    await user.click(screen.getByText("Color"));
    // Running total: 30 + 60 = 90 minutes.
    expect(screen.getByText("90 min")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // Availability is requested for both services at once.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [availUrl] = fetchMock.mock.calls[0];
    expect(String(availUrl)).toContain("service_ids=svc_1%2Csvc_2");

    const slotButton = await screen.findByRole("button", { name: /9:00/ });
    await user.click(slotButton);
    await fillDetailsAndSubmit(user);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/book"), expect.anything()));
    const bookCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/book"))!;
    const body = JSON.parse((bookCall[1] as RequestInit).body as string);
    expect(body.service_ids).toEqual(["svc_1", "svc_2"]);
  });

  it("jumps straight to the slot step and loads availability on mount when a service is preselected", async () => {
    const fetchMock = setupFetch({ slots: [slotNoStaff] });
    render(
      <CalendarBookingFlow
        instanceId="inst_1"
        services={[service]}
        timezone="UTC"
        businessName="Acme"
        initialServiceId="svc_1"
      />
    );

    expect(screen.queryByText("Choose a service")).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await screen.findByRole("button", { name: /9:00/ });
  });
});

describe("CalendarBookingFlow — multi-location mode", () => {
  const locA: Location = {
    id: "loc_a",
    name: "Downtown",
    services: [service],
    staff: [],
    availability: {},
    blackout_dates: [],
  };
  const locB: Location = {
    id: "loc_b",
    name: "Uptown",
    services: [service2],
    staff: [],
    availability: {},
    blackout_dates: [],
  };

  it("starts on the location step when there are 2+ locations, then scopes services to the chosen one", async () => {
    setupFetch();
    const user = userEvent.setup();
    render(
      <CalendarBookingFlow instanceId="inst_1" locations={[locA, locB]} services={[]} timezone="UTC" businessName="Acme" />
    );

    expect(screen.getByText("Choose a location")).toBeInTheDocument();
    expect(screen.getByText("Downtown")).toBeInTheDocument();
    expect(screen.getByText("Uptown")).toBeInTheDocument();

    await user.click(screen.getByText("Downtown"));

    expect(screen.getByText("Choose a service")).toBeInTheDocument();
    expect(screen.getByText("Haircut")).toBeInTheDocument();
    expect(screen.queryByText("Color")).not.toBeInTheDocument();
  });

  it("includes location_id in the availability request once a location is picked", async () => {
    const fetchMock = setupFetch();
    const user = userEvent.setup();
    render(
      <CalendarBookingFlow instanceId="inst_1" locations={[locA, locB]} services={[]} timezone="UTC" businessName="Acme" />
    );

    await user.click(screen.getByText("Downtown"));
    await user.click(screen.getByText("Haircut"));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain("location_id=loc_a");
  });

  it("auto-defaults a single location without showing the location step", () => {
    setupFetch();
    render(
      <CalendarBookingFlow instanceId="inst_1" locations={[locA]} services={[]} timezone="UTC" businessName="Acme" />
    );
    expect(screen.queryByText("Choose a location")).not.toBeInTheDocument();
    expect(screen.getByText("Choose a service")).toBeInTheDocument();
    expect(screen.getByText("Haircut")).toBeInTheDocument();
  });
});
