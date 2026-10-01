import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "./route";

const mockBookingMaybeSingle = vi.fn();
const mockRpcSingle = vi.fn();
const mockRpc = vi.fn(() => ({ single: mockRpcSingle }));
const mockGetUser = vi.fn(async () => ({ data: { user: { id: "owner_1" } } }));

const mockFrom = vi.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle: mockBookingMaybeSingle }) }),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mockFrom, rpc: mockRpc }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

function params(token = "tok_1") {
  return { params: Promise.resolve({ token }) };
}
function patchReq(body: unknown) {
  return new Request("http://localhost/api/widgets/bookings/tok_1/staff", {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "owner_1" } } });
  mockBookingMaybeSingle.mockResolvedValue({
    data: { id: "bkg_1", owner_user_id: "owner_1", status: "confirmed" },
  });
});

describe("PATCH /api/widgets/bookings/[token]/staff (reassign)", () => {
  it("400s when service_id or staff_id is missing", async () => {
    const res = await PATCH(patchReq({ service_id: "svc_1" }), params());
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("404s when the booking is not found", async () => {
    mockBookingMaybeSingle.mockResolvedValue({ data: null });
    const res = await PATCH(patchReq({ service_id: "svc_1", staff_id: "st_b" }), params());
    expect(res.status).toBe(404);
  });

  it("403s when the caller isn't the owner", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "intruder" } } });
    const res = await PATCH(patchReq({ service_id: "svc_1", staff_id: "st_b" }), params());
    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("409s when the booking was cancelled", async () => {
    mockBookingMaybeSingle.mockResolvedValue({
      data: { id: "bkg_1", owner_user_id: "owner_1", status: "cancelled" },
    });
    const res = await PATCH(patchReq({ service_id: "svc_1", staff_id: "st_b" }), params());
    expect(res.status).toBe(409);
  });

  it("reassigns via set_booking_segment_staff_tx and returns the new staff", async () => {
    mockRpcSingle.mockResolvedValue({
      data: { staff_id: "st_b", staff_name: "Anny Natalia", services: null },
      error: null,
    });
    const res = await PATCH(patchReq({ service_id: "svc_1", staff_id: "st_b" }), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, staff_id: "st_b", staff_name: "Anny Natalia" });
    expect(mockRpc).toHaveBeenCalledWith("set_booking_segment_staff_tx", {
      p_token: "tok_1",
      p_service_id: "svc_1",
      p_staff_id: "st_b",
    });
  });

  it("does NOT block an ineligible staff member (owner override — flexibility)", async () => {
    // The route no longer checks eligibility; it defers to the RPC. A successful
    // RPC ⇒ the reassignment goes through even for a non-eligible staff member.
    mockRpcSingle.mockResolvedValue({
      data: { staff_id: "st_x", staff_name: "Override", services: null },
      error: null,
    });
    const res = await PATCH(patchReq({ service_id: "svc_1", staff_id: "st_x" }), params());
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalled();
  });

  it("maps a time-clash (STAFF_UNAVAILABLE) from the RPC to 409", async () => {
    mockRpcSingle.mockResolvedValue({ data: null, error: { message: "STAFF_UNAVAILABLE" } });
    const res = await PATCH(patchReq({ service_id: "svc_1", staff_id: "st_b" }), params());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe("STAFF_UNAVAILABLE");
  });
});
