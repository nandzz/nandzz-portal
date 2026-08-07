import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import type { WidgetBooking } from "@/lib/types";

const mockGetUser = vi.fn();
const mockRpcSingle = vi.fn();
const mockRpc = vi.fn(() => ({ single: mockRpcSingle }));
const mockInstanceMaybeSingle = vi.fn();
const mockFrom = vi.fn(() => ({
  select: () => ({
    eq: () => ({ maybeSingle: mockInstanceMaybeSingle }),
  }),
}));
const mockDispatch = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mockRpc, from: mockFrom }),
}));

vi.mock("@/lib/widgets/notify", () => ({
  dispatchBookingMessage: (...args: unknown[]) => mockDispatch(...args),
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
    data: { config: {}, owner: { display_name: "Acme", username: "acme" }, catalog: { currency: "usd" } },
  });
});

describe("POST /api/widgets/[instanceId]/book", () => {
  it("400s when a required field is missing", async () => {
    const res = await POST(makeReq({ ...validBody, customer_email: undefined }), params());
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("400s when customer_phone is present but blank", async () => {
    const res = await POST(makeReq({ ...validBody, customer_phone: "   " }), params());
    expect(res.status).toBe(400);
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

  it("dispatches the owner's confirmation message on success", async () => {
    mockRpcSingle.mockResolvedValue({ data: bookingRow({ staff_name: "Alex" }), error: null });

    await POST(makeReq(validBody), params());

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    const [, ctx] = mockDispatch.mock.calls[0];
    expect(ctx.customerEmail).toBe("jamie@example.com");
    expect(ctx.staffName).toBe("Alex");
    expect(ctx.manageUrl).toBe("http://localhost:3000/booking/tok_abc");
  });

  it("does not dispatch a confirmation when the RPC fails", async () => {
    mockRpcSingle.mockResolvedValue({ data: null, error: { message: "SLOT_TAKEN" } });

    await POST(makeReq(validBody), params());

    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
