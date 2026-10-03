import { describe, it, expect, vi, beforeEach } from "vitest";

let mockUser: { id: string } | null;
let rpcResult: { data: unknown; error: { message: string } | null };
let rpcArgs: Record<string, unknown> | null;
let insertedPayload: Record<string, unknown> | null;

vi.mock("next/navigation", () => ({
  // redirect() throws NEXT_REDIRECT in real Next; emulate with a sentinel so
  // the success path is observable in a unit test.
  redirect: (url: string) => {
    throw new Error("REDIRECT:" + url);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
    rpc: async (_fn: string, args: Record<string, unknown>) => {
      rpcArgs = args;
      return rpcResult;
    },
    from: () => ({
      insert: async (payload: Record<string, unknown>) => {
        insertedPayload = payload;
        return { error: null };
      },
    }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (_fn: string, args: Record<string, unknown>) => {
      rpcArgs = args;
      return rpcResult;
    },
  }),
}));

import { publishSpace } from "./publish-space";

const payload = { title: "New" };

beforeEach(() => {
  mockUser = { id: "user_1" };
  rpcResult = { data: [{ space_id: "sp_1" }], error: null };
  rpcArgs = null;
  insertedPayload = null;
});

describe("publishSpace", () => {
  it("returns UNAUTHENTICATED without a user", async () => {
    mockUser = null;
    const res = await publishSpace(payload, "req_1");
    expect(res).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("maps a SPACE_LIMIT_REACHED rpc error", async () => {
    rpcResult = { data: null, error: { message: "SPACE_LIMIT_REACHED: cap" } };
    const res = await publishSpace(payload, "req_1");
    expect(res).toEqual({ ok: false, error: "SPACE_LIMIT_REACHED" });
  });

  it("returns FAILED on a generic rpc error", async () => {
    rpcResult = { data: null, error: { message: "boom" } };
    const res = await publishSpace(payload, "req_1");
    expect(res).toEqual({ ok: false, error: "FAILED", message: "boom" });
  });

  it("returns FAILED when no space_id comes back", async () => {
    rpcResult = { data: [{}], error: null };
    const res = await publishSpace(payload, "req_1");
    expect(res).toEqual({ ok: false, error: "FAILED", message: "no space_id returned" });
  });

  it("forwards the idempotency token and redirects to contents on success", async () => {
    await expect(publishSpace(payload, "req_1")).rejects.toThrow(
      "REDIRECT:/dashboard/contents"
    );
    expect(rpcArgs?.p_client_request_id).toBe("req_1");
    expect(insertedPayload).toBeNull();
  });

  it("links the new space into a collection and redirects there", async () => {
    await expect(publishSpace(payload, "req_1", "col_1")).rejects.toThrow(
      "REDIRECT:/dashboard/collections/col_1"
    );
    expect(insertedPayload).toEqual({ collection_id: "col_1", space_id: "sp_1" });
  });
});
