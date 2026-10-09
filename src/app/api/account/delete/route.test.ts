import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "./route";

const mockGetUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockProfile = vi.fn();
const mockListSubs = vi.fn();
const mockCancelSub = vi.fn();
let stripeConfigured = true;

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { deleteUser: mockDeleteUser } },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mockProfile }) }),
    }),
  }),
}));

vi.mock("@/lib/stripe/server", () => ({
  isStripeConfigured: () => stripeConfigured,
  getStripe: () => ({
    subscriptions: { list: mockListSubs, cancel: mockCancelSub },
  }),
}));

// next/headers is imported transitively by the server client; stub it out
vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [], set: vi.fn() }),
}));

// Stripe's list() returns an auto-paginating async iterable.
function subs(list: { id: string; status: string }[]) {
  return {
    async *[Symbol.asyncIterator]() {
      yield* list;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  stripeConfigured = true;
  mockProfile.mockResolvedValue({ data: { stripe_customer_id: null } });
  mockListSubs.mockReturnValue(subs([]));
  mockCancelSub.mockResolvedValue({});
});

describe("DELETE /api/account/delete", () => {
  it("returns 401 when no user is authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await DELETE();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("calls deleteUser with the authenticated user's id", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockDeleteUser.mockResolvedValue({ error: null });

    await DELETE();

    expect(mockDeleteUser).toHaveBeenCalledWith("user-123");
  });

  it("returns 200 with success:true on successful deletion", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockDeleteUser.mockResolvedValue({ error: null });

    const res = await DELETE();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 500 with error message when deleteUser fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockDeleteUser.mockResolvedValue({ error: { message: "Deletion failed" } });

    const res = await DELETE();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Deletion failed");
  });

  it("cancels live Stripe subscriptions before deleting", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockDeleteUser.mockResolvedValue({ error: null });
    mockProfile.mockResolvedValue({ data: { stripe_customer_id: "cus_1" } });
    mockListSubs.mockReturnValue(
      subs([
        { id: "sub_active", status: "active" },
        { id: "sub_trial", status: "trialing" },
        { id: "sub_old", status: "canceled" },
      ])
    );

    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(mockListSubs).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_1" }));
    expect(mockCancelSub.mock.calls.map((c) => c[0])).toEqual(["sub_active", "sub_trial"]);
    expect(mockDeleteUser).toHaveBeenCalledWith("user-123");
  });

  it("aborts without deleting when Stripe cancellation fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockProfile.mockResolvedValue({ data: { stripe_customer_id: "cus_1" } });
    mockListSubs.mockReturnValue(subs([{ id: "sub_active", status: "active" }]));
    mockCancelSub.mockRejectedValue(new Error("stripe down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await DELETE();

    expect(res.status).toBe(502);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("skips Stripe when it isn't configured", async () => {
    stripeConfigured = false;
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockDeleteUser.mockResolvedValue({ error: null });
    mockProfile.mockResolvedValue({ data: { stripe_customer_id: "cus_1" } });

    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(mockListSubs).not.toHaveBeenCalled();
  });
});
