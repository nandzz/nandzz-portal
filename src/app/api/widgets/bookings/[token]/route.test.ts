import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, DELETE, PATCH } from "./route";
import type { CalendarConfig, WidgetBooking } from "@/lib/types";

const mockLoadMaybeSingle = vi.fn();
const mockUpdateStatusResult = vi.fn();
const mockSegmentsResult = vi.fn(() => ({ data: [] }));
const mockBusyResult = vi.fn(() => ({ data: [] }));
const mockRpcSingle = vi.fn();
const mockRpc = vi.fn(() => ({ single: mockRpcSingle }));
const mockUpdatePatch = vi.fn();

// Chainable stand-in for widget_booking_segments. The reschedule context loads
// segments via `.select().eq().eq().order()` (resolves to mockSegmentsResult);
// the PATCH/slots busy read ends by awaiting the builder (mockBusyResult).
function segmentsBuilder(): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "gte", "lte", "is"]) b[m] = () => b;
  b.order = () => ({
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(mockSegmentsResult()).then(res, rej),
  });
  b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(mockBusyResult()).then(res, rej);
  return b;
}

const mockFrom = vi.fn((table: string) => {
  if (table === "widget_booking_segments") return segmentsBuilder();
  // widget_bookings: loadBooking / loadRescheduleContext select(...).eq().maybeSingle();
  // DELETE update({status}).eq().
  return {
    select: () => ({ eq: () => ({ maybeSingle: mockLoadMaybeSingle }) }),
    update: (patch: Record<string, unknown>) => {
      mockUpdatePatch(patch);
      return { eq: () => Promise.resolve(mockUpdateStatusResult()) };
    },
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom, rpc: mockRpc }),
}));

// resolveActor() reads the SSR session — default "no user" ⇒ actor "customer".
const mockGetUser = vi.fn(async () => ({ data: { user: null } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

function params(token = "tok_1") {
  return { params: Promise.resolve({ token }) };
}

function patchReq(body: unknown) {
  return new Request("http://localhost/api/widgets/bookings/tok_1", {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof PATCH>[0];
}

const config: CalendarConfig = {
  timezone: "UTC",
  currency: "eur",
  buffer_min: 0,
  show_prices: true,
  collect_address: false,
  address_required: false,
  whatsapp_reminder: true,
  whatsapp_reminder_hours: 4,
  whatsapp_contact_phone: "",
  locations: [],
  services: [{ id: "svc_1", name: "Haircut", duration_min: 30 }],
  availability: { mon: [["09:00", "17:00"]], tue: [["09:00", "17:00"]] },
  blackout_dates: [],
  staff: [],
  messages: {
    confirmation: { channel: "off", subject: "", body: "" },
    cancellation: { channel: "both", subject: "Cancelled", body: "Sorry {{customer_first_name}}" },
    reschedule: { channel: "off", subject: "", body: "" },
    reminder: { channel: "off", subject: "", body: "" },
  },
};

function booking(overrides: Partial<WidgetBooking> = {}): WidgetBooking {
  return {
    id: "bkg_1",
    instance_id: "inst_1",
    owner_user_id: "user_1",
    service_id: "svc_1",
    service_name: "Haircut",
    duration_min: 30,
    price_cents: 4000,
    staff_id: null,
    staff_name: null,
    location_id: null,
    location_name: null,
    starts_at: "2026-08-10T09:00:00.000Z",
    ends_at: "2026-08-10T09:30:00.000Z",
    customer_name: "Jamie Rivera",
    customer_email: "jamie@example.com",
    customer_phone: "+15551234567",
    customer_address: null,
    notes: null,
    status: "confirmed",
    manage_token: "tok_1",
    created_by_user_id: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function loadRow(bookingOverrides: Partial<WidgetBooking> = {}, instanceOverrides: Record<string, unknown> = {}) {
  return {
    ...booking(bookingOverrides),
    instance: {
      config,
      enabled: true,
      owner: { display_name: "Acme", username: "acme" },
      ...instanceOverrides,
    },
  };
}

function rescheduled(overrides: Partial<WidgetBooking> = {}) {
  return {
    data: booking({
      starts_at: "2026-08-11T09:00:00.000Z",
      ends_at: "2026-08-11T09:30:00.000Z",
      ...overrides,
    }),
    error: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSegmentsResult.mockReturnValue({ data: [] });
  mockBusyResult.mockReturnValue({ data: [] });
});

describe("GET /api/widgets/bookings/[token]", () => {
  it("404s when the token doesn't match any booking", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: null });
    const res = await GET(new Request("http://x") as never, params());
    expect(res.status).toBe(404);
  });

  it("presents the booking with the business name and resolved timezone", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow() });
    const res = await GET(new Request("http://x") as never, params());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.business_name).toBe("Acme");
    expect(body.timezone).toBe("UTC");
    expect(body.status).toBe("confirmed");
  });

  it("falls back to the username when display_name is unset", async () => {
    mockLoadMaybeSingle.mockResolvedValue({
      data: loadRow({}, { owner: { display_name: "", username: "acme_user" } }),
    });
    const res = await GET(new Request("http://x") as never, params());
    const body = await res.json();
    expect(body.business_name).toBe("acme_user");
  });
});

describe("DELETE /api/widgets/bookings/[token]", () => {
  it("404s when the token doesn't match any booking", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: null });
    const res = await DELETE(new Request("http://x") as never, params());
    expect(res.status).toBe(404);
  });

  it("cancels the booking and records the actor for the notify trigger", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow({ status: "confirmed" }) });
    mockUpdateStatusResult.mockReturnValue({ error: null });

    const res = await DELETE(new Request("http://x") as never, params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, status: "cancelled" });
    expect(mockUpdatePatch).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled", notify_actor: "customer" })
    );
  });

  it("500s with the DB error message when the update fails", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow() });
    mockUpdateStatusResult.mockReturnValue({ error: { message: "db exploded" } });

    const res = await DELETE(new Request("http://x") as never, params());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("db exploded");
  });
});

describe("PATCH /api/widgets/bookings/[token] (reschedule)", () => {
  // Fixtures target Aug 2026; freeze "now" just before them so the lead-time
  // filter treats those slots as bookable regardless of the wall clock.
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-05T00:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("400s when starts_at is missing", async () => {
    const res = await PATCH(patchReq({}), params());
    expect(res.status).toBe(400);
  });

  it("404s when the token doesn't match any booking", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: null });
    const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z" }), params());
    expect(res.status).toBe(404);
  });

  it("409s when the booking is already cancelled", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow({ status: "cancelled" }) });
    const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z" }), params());
    expect(res.status).toBe(409);
  });

  it("409s when the widget instance is disabled", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow({}, { enabled: false }) });
    const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z" }), params());
    expect(res.status).toBe(409);
  });

  it("409s when the requested time isn't an open slot", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow() });
    // Tuesday 03:00 UTC is outside the 09:00-17:00 window.
    const res = await PATCH(patchReq({ starts_at: "2026-08-11T03:00:00.000Z" }), params());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe("That time isn't available.");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("reschedules to a valid slot via reschedule_booking_tx and records the actor", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow() });
    mockRpcSingle.mockResolvedValue(rescheduled());

    const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z" }), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, starts_at: "2026-08-11T09:00:00.000Z" });
    expect(mockRpc).toHaveBeenCalledWith(
      "reschedule_booking_tx",
      expect.objectContaining({
        p_token: "tok_1",
        p_starts_at: "2026-08-11T09:00:00.000Z",
        p_actor: "customer",
        p_segments: expect.any(Array),
      })
    );
  });

  it("409s with 'just taken' when the RPC reports SLOT_TAKEN", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow() });
    mockRpcSingle.mockResolvedValue({ data: null, error: { message: "SLOT_TAKEN" } });

    const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z" }), params());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("That slot was just taken. Please pick another.");
  });

  it("500s on a non-clash RPC failure", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow() });
    mockRpcSingle.mockResolvedValue({ data: null, error: { message: "boom" } });

    const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z" }), params());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to reschedule.");
  });

  it("still reschedules using the stored segment even if the config service was later removed", async () => {
    // Reschedule reads the booking's own segments (here the aggregate fallback),
    // so a config edit doesn't strand an existing booking.
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow({ service_id: "svc_removed" }) });
    mockRpcSingle.mockResolvedValue(rescheduled({ service_id: "svc_removed" }));

    const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z" }), params());
    expect(res.status).toBe(200);
  });

  it("preserves the booking's assigned staff on reschedule (pins it in the segment plan)", async () => {
    const staffConfig: CalendarConfig = {
      ...config,
      staff: [{ id: "st_a", name: "Alex", availability: { tue: [["09:00", "17:00"]] } }],
    };
    mockLoadMaybeSingle.mockResolvedValue({
      data: loadRow({ staff_id: "st_a", staff_name: "Alex" }, { config: staffConfig }),
    });
    mockRpcSingle.mockResolvedValue(rescheduled({ staff_id: "st_a", staff_name: "Alex" }));

    const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z" }), params());
    expect(res.status).toBe(200);

    const [, args] = mockRpc.mock.calls[0] as unknown as [string, { p_segments: { staff_ids: string[] }[] }];
    expect(args.p_segments[0].staff_ids).toEqual(["st_a"]);
  });
});
