import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import type { CalendarConfig, WidgetBooking } from "@/lib/types";

const mockGetUser = vi.fn();
const mockRpcSingle = vi.fn();
const mockRpc = vi.fn(() => ({ single: mockRpcSingle }));
const mockInstanceMaybeSingle = vi.fn();

// Chainable stand-in for the busy-segments read (widget_booking_segments).
function segmentsBuilder(): unknown {
  const builder: Record<string, unknown> = {};
  const chain = () => () => builder;
  for (const m of ["select", "eq", "gte", "lte", "is"]) builder[m] = chain();
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve({ data: [] }).then(resolve, reject);
  return builder;
}

const mockOptInEq = vi.fn(async () => ({ error: null }));
const mockOptInUpdate = vi.fn(() => ({ eq: mockOptInEq }));
const mockFrom = vi.fn((table: string) => {
  if (table === "widget_booking_segments") return segmentsBuilder();
  if (table === "widget_bookings") return { update: mockOptInUpdate };
  return { select: () => ({ eq: () => ({ maybeSingle: mockInstanceMaybeSingle }) }) };
});

// Minimal calendar config: a single unstaffed service open Mondays, plus a
// location carrying the same service (for the location-scoped assertion).
const bookConfig: CalendarConfig = {
  timezone: "UTC",
  currency: "usd",
  buffer_min: 0,
  show_prices: true,
  collect_address: false,
  address_required: false,
  whatsapp_reminder: true,
  whatsapp_reminder_hours: 4,
  services: [{ id: "svc_1", name: "Haircut", duration_min: 30 }],
  availability: { mon: [["09:00", "17:00"]] },
  blackout_dates: [],
  staff: [],
  locations: [
    {
      id: "loc_1",
      name: "Downtown",
      services: [{ id: "svc_1", name: "Haircut", duration_min: 30 }],
      staff: [],
      availability: { mon: [["09:00", "17:00"]] },
      blackout_dates: [],
    },
  ],
  messages: {
    confirmation: { channel: "off", subject: "", body: "" },
    cancellation: { channel: "off", subject: "", body: "" },
    reschedule: { channel: "off", subject: "", body: "" },
    reminder: { channel: "off", subject: "", body: "" },
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mockRpc, from: mockFrom }),
}));

function makeReq(body: unknown) {
  return new Request("http://localhost/api/widgets/inst_1/book", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

function params(instanceId = "inst_1") {
  return { params: Promise.resolve({ instanceId }) };
}

const validBody = {
  service_id: "svc_1",
  starts_at: "2026-08-10T09:00:00.000Z",
  customer_name: "Jamie Rivera",
  customer_email: "jamie@example.com",
  customer_phone: "+15551234567",
};

function bookingRow(overrides: Partial<WidgetBooking> = {}): WidgetBooking {
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
    manage_token: "tok_abc",
    created_by_user_id: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: null } });
  mockRpc.mockImplementation(() => ({ single: mockRpcSingle }));
  mockInstanceMaybeSingle.mockResolvedValue({
    data: { config: bookConfig, owner: { display_name: "Acme", username: "acme" } },
  });
});

describe("POST /api/widgets/[instanceId]/book", () => {
  it("400s when a required field (customer_name) is missing", async () => {
    const res = await POST(makeReq({ ...validBody, customer_name: undefined }), params());
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("400s when customer_phone is present but blank", async () => {
    const res = await POST(makeReq({ ...validBody, customer_phone: "   " }), params());
    expect(res.status).toBe(400);
  });

  it("allows a booking with no email (owner manual / phone-in), passing null email through", async () => {
    mockRpcSingle.mockResolvedValue({ data: bookingRow({ customer_email: "" }), error: null });

    const res = await POST(makeReq({ ...validBody, customer_email: undefined }), params());

    expect(res.status).toBe(201);
    expect(mockRpc).toHaveBeenCalledWith(
      "create_booking_tx",
      expect.objectContaining({ p_customer_email: null })
    );
  });

  it("creates the booking and returns 201 with a manage_url on success", async () => {
    mockRpcSingle.mockResolvedValue({ data: bookingRow(), error: null });

    const res = await POST(makeReq(validBody), params());
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.manage_url).toBe("http://localhost:3000/booking/tok_abc");
    expect(body.booking).toEqual({
      id: "bkg_1",
      service_name: "Haircut",
      starts_at: "2026-08-10T09:00:00.000Z",
      ends_at: "2026-08-10T09:30:00.000Z",
    });
  });

  it("maps an RPC error message to the corresponding status/code", async () => {
    mockRpcSingle.mockResolvedValue({ data: null, error: { message: "SLOT_TAKEN" } });

    const res = await POST(makeReq(validBody), params());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("SLOT_TAKEN");
  });

  it("falls back to a 500 GENERIC error for an unrecognized RPC failure", async () => {
    mockRpcSingle.mockResolvedValue({ data: null, error: { message: "boom" } });

    const res = await POST(makeReq(validBody), params());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("GENERIC");
  });

  it("passes the resolved instanceId and body fields through to create_booking_tx", async () => {
    mockRpcSingle.mockResolvedValue({ data: bookingRow(), error: null });

    await POST(makeReq({ ...validBody, staff_id: "st_1", location_id: "loc_1", notes: "Allergic to nuts" }), params("inst_7"));

    expect(mockRpc).toHaveBeenCalledWith(
      "create_booking_tx",
      expect.objectContaining({
        p_instance_id: "inst_7",
        p_service_id: "svc_1",
        p_customer_name: "Jamie Rivera",
        p_staff_id: "st_1",
        p_location_id: "loc_1",
        p_notes: "Allergic to nuts",
        p_created_by: null,
      })
    );
  });

  it("attributes the booking to the signed-in user when present", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user_42" } } });
    mockRpcSingle.mockResolvedValue({ data: bookingRow(), error: null });

    await POST(makeReq(validBody), params());

    expect(mockRpc).toHaveBeenCalledWith(
      "create_booking_tx",
      expect.objectContaining({ p_created_by: "user_42" })
    );
  });

  it("leaves created_by null when getUser throws (e.g. no session cookie)", async () => {
    mockGetUser.mockRejectedValue(new Error("no session"));
    mockRpcSingle.mockResolvedValue({ data: bookingRow(), error: null });

    const res = await POST(makeReq(validBody), params());

    expect(res.status).toBe(201);
    expect(mockRpc).toHaveBeenCalledWith(
      "create_booking_tx",
      expect.objectContaining({ p_created_by: null })
    );
  });

  it("saves the WhatsApp reminder opt-in when the customer consents", async () => {
    mockRpcSingle.mockResolvedValue({ data: bookingRow(), error: null });

    const res = await POST(makeReq({ ...validBody, whatsapp_opt_in: true }), params());

    expect(res.status).toBe(201);
    expect(mockOptInUpdate).toHaveBeenCalledWith({ whatsapp_opt_in: true });
    expect(mockOptInEq).toHaveBeenCalledWith("id", "bkg_1");
  });

  it("does not opt in without explicit consent", async () => {
    mockRpcSingle.mockResolvedValue({ data: bookingRow(), error: null });

    await POST(makeReq({ ...validBody, whatsapp_opt_in: false }), params());

    expect(mockOptInUpdate).not.toHaveBeenCalled();
  });
});
