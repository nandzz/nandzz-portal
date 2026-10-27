import { describe, it, expect, vi, beforeEach } from "vitest";

const APPROVAL_ID = "3903cee0-b1f1-48b6-be4a-8bc550f5c114";

let mockUser: { id: string } | null;
let claimResult: { data: unknown; error: { message: string } | null };
let claimFilters: [string, unknown][];
let claimPatch: Record<string, unknown> | null;
let updates: { table: string; patch: Record<string, unknown> }[];
let inserts: { table: string; row: Record<string, unknown> }[];

vi.mock("@/lib/flags", () => ({ FEATURES: { businessAgent: true } }));

const executeApproval = vi.fn();
const notifyApprovalDecided = vi.fn();

const claimed = {
  id: APPROVAL_ID,
  owner_user_id: "owner_1",
  thread_id: "thread_1",
  kind: "new_booking",
  booking_id: null,
  request: { service_ids: ["svc_1"], starts_at: "2026-11-03T10:00:00Z" },
  thread: {
    customer_wa_id: "393330000000",
    customer_name: "Giulia",
    connection: { phone_number_id: "PN_1", widget_instance_id: "inst_1" },
  },
};

function adminBuilder(table: string) {
  const b: Record<string, unknown> = {};
  b.update = (patch: Record<string, unknown>) => {
    // The claim is the first update on agent_approvals (it selects back).
    if (table === "agent_approvals" && claimPatch === null) {
      claimPatch = patch;
      const q: Record<string, unknown> = {};
      q.eq = (col: string, val: unknown) => {
        claimFilters.push([col, val]);
        return q;
      };
      q.select = () => q;
      q.maybeSingle = async () => claimResult;
      return q;
    }
    updates.push({ table, patch });
    const q: Record<string, unknown> = {};
    q.eq = () => q;
    q.then = (resolve: (v: unknown) => void) => resolve({ error: null });
    return q;
  };
  b.insert = async (row: Record<string, unknown>) => {
    inserts.push({ table, row });
    return { error: null };
  };
  return b;
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mockUser } }) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => adminBuilder(t) }) }));
vi.mock("../server/execute-approval", () => ({ executeApproval: (...a: unknown[]) => executeApproval(...a) }));
vi.mock("../server/notify-worker", () => ({ notifyApprovalDecided: (...a: unknown[]) => notifyApprovalDecided(...a) }));

import { decideApproval } from "./decide-approval";

beforeEach(() => {
  mockUser = { id: "owner_1" };
  claimResult = { data: claimed, error: null };
  claimFilters = [];
  claimPatch = null;
  updates = [];
  inserts = [];
  executeApproval.mockReset();
  executeApproval.mockResolvedValue({ ok: true, bookingId: "bk_1", summary: "Nails" });
  notifyApprovalDecided.mockReset();
});

describe("decideApproval", () => {
  it("rejects bad input without touching the database", async () => {
    expect(await decideApproval({ approvalId: "nope", decision: "approve" })).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(claimPatch).toBeNull();
  });

  it("requires a signed-in owner", async () => {
    mockUser = null;
    expect(await decideApproval({ approvalId: APPROVAL_ID, decision: "approve" })).toEqual({
      ok: false,
      error: "UNAUTHENTICATED",
    });
  });

  it("claims only the caller's still-pending approval", async () => {
    await decideApproval({ approvalId: APPROVAL_ID, decision: "approve" });
    expect(claimFilters).toEqual([
      ["id", APPROVAL_ID],
      ["owner_user_id", "owner_1"],
      ["status", "pending"],
    ]);
  });

  it("does nothing when the approval was already decided", async () => {
    claimResult = { data: null, error: null };
    expect(await decideApproval({ approvalId: APPROVAL_ID, decision: "approve" })).toEqual({
      ok: false,
      error: "NOT_PENDING",
    });
    expect(executeApproval).not.toHaveBeenCalled();
    expect(notifyApprovalDecided).not.toHaveBeenCalled();
  });

  it("reject: records it and pings the worker, without executing", async () => {
    const res = await decideApproval({ approvalId: APPROVAL_ID, decision: "reject" });
    expect(res).toEqual({ ok: true, status: "rejected" });
    expect(claimPatch?.status).toBe("rejected");
    expect(executeApproval).not.toHaveBeenCalled();
    expect(inserts[0].row.kind).toBe("approval_rejected");
    expect(notifyApprovalDecided).toHaveBeenCalledWith({
      approvalId: APPROVAL_ID,
      phoneNumberId: "PN_1",
      customerWaId: "393330000000",
    });
  });

  it("approve: executes, links the booking and logs it", async () => {
    executeApproval.mockResolvedValue({ ok: true, bookingId: "bk_1", summary: "Nails, Tue 03 Nov 11:00" });
    const res = await decideApproval({ approvalId: APPROVAL_ID, decision: "approve" });
    expect(res).toEqual({ ok: true, status: "approved" });
    expect(updates).toContainEqual({ table: "agent_approvals", patch: { booking_id: "bk_1" } });
    expect(inserts[0].row).toMatchObject({ kind: "booking_created", summary: "Nails, Tue 03 Nov 11:00" });
    expect(notifyApprovalDecided).toHaveBeenCalled();
  });

  it("approve when the slot is gone: ends as failed and still tells the customer", async () => {
    executeApproval.mockResolvedValue({ ok: false, outcome: "slot_taken" });
    const res = await decideApproval({ approvalId: APPROVAL_ID, decision: "approve" });
    expect(res).toEqual({ ok: true, status: "failed", outcome: "slot_taken" });
    expect(updates).toContainEqual({ table: "agent_approvals", patch: { status: "failed", outcome: "slot_taken" } });
    expect(inserts[0].row.kind).toBe("approval_failed");
    expect(notifyApprovalDecided).toHaveBeenCalled();
  });
});
