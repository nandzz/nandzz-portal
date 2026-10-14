import { describe, it, expect, vi, beforeEach } from "vitest";

let mockUser: { id: string } | null;
let updateResult: { error: { message: string } | null };
let updatePayload: Record<string, unknown> | null;
let eqFilter: [string, unknown] | null;

function builder() {
  const b: Record<string, unknown> = {};
  b.update = (payload: Record<string, unknown>) => {
    updatePayload = payload;
    return b;
  };
  b.eq = (col: string, val: unknown) => {
    eqFilter = [col, val];
    return b;
  };
  b.select = () => b;
  b.single = () =>
    Promise.resolve({ data: updateResult.error ? null : { username: "ada" }, ...updateResult });
  return b;
}

vi.mock("../revalidate", () => ({ revalidatePublicProfile: () => {} }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
    from: () => builder(),
  }),
}));

import { setSectionVisibility } from "./set-section-visibility";

beforeEach(() => {
  mockUser = { id: "user_1" };
  updateResult = { error: null };
  updatePayload = null;
  eqFilter = null;
});

describe("setSectionVisibility", () => {
  it("rejects an unknown section", async () => {
    const res = await setSectionVisibility({ section: "bogus", value: true });
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  it("returns UNAUTHENTICATED without a user", async () => {
    mockUser = null;
    const res = await setSectionVisibility({ section: "gallery", value: false });
    expect(res).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("updates the mapped column scoped to the caller's own row", async () => {
    const res = await setSectionVisibility({ section: "links", value: false });
    expect(res).toEqual({ ok: true });
    expect(updatePayload).toEqual({ show_links: false });
    expect(eqFilter).toEqual(["id", "user_1"]);
  });

  it("surfaces a DB error as FAILED", async () => {
    updateResult = { error: { message: "boom" } };
    const res = await setSectionVisibility({ section: "informative", value: true });
    expect(res).toEqual({ ok: false, error: "FAILED", message: "boom" });
  });
});
