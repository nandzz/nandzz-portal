import { describe, it, expect, vi, beforeEach } from "vitest";

let mockUser: { id: string } | null;
let insertError: { code?: string; message: string } | null;
let insertedRow: Record<string, unknown> | undefined;
// Row the "already counted today" lookup finds (null = first view today).
let existingRow: { id: string } | null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => {
        const chain = {
          eq: () => chain,
          limit: () => chain,
          maybeSingle: async () => ({ data: existingRow }),
        };
        return chain;
      },
      insert: async (row: Record<string, unknown>) => {
        insertedRow = row;
        return { error: insertError };
      },
    }),
  }),
}));

import { recordSpaceView } from "./record-view";

const SPACE_ID = "44444444-4444-4444-8444-444444444444";
const OWNER_ID = "55555555-5555-4555-9555-555555555555";

beforeEach(() => {
  mockUser = { id: "viewer_1" };
  insertError = null;
  insertedRow = undefined;
  existingRow = null;
});

describe("recordSpaceView", () => {
  it("rejects non-uuid ids", async () => {
    expect(await recordSpaceView("nope", OWNER_ID)).toEqual({
      ok: false,
      error: "INVALID_INPUT",
    });
    expect(insertedRow).toBeUndefined();
  });

  it("does not count the owner's own view", async () => {
    mockUser = { id: OWNER_ID };
    expect(await recordSpaceView(SPACE_ID, OWNER_ID)).toEqual({
      ok: false,
      error: "OWNER",
    });
    expect(insertedRow).toBeUndefined();
  });

  it("skips the insert when the visitor was already counted today", async () => {
    existingRow = { id: "view_1" };
    expect(await recordSpaceView(SPACE_ID, OWNER_ID)).toEqual({ ok: true });
    expect(insertedRow).toBeUndefined();
  });

  it("records a view for a signed-in visitor", async () => {
    const res = await recordSpaceView(SPACE_ID, OWNER_ID);
    expect(res).toEqual({ ok: true });
    expect(insertedRow).toMatchObject({
      space_id: SPACE_ID,
      viewer_id: "viewer_1",
    });
    expect(insertedRow?.viewed_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("records an anonymous view (null viewer)", async () => {
    mockUser = null;
    const res = await recordSpaceView(SPACE_ID, OWNER_ID);
    expect(res).toEqual({ ok: true });
    expect(insertedRow).toMatchObject({ viewer_id: null });
  });

  it("treats a unique-violation (per-day dedup) as success", async () => {
    insertError = { code: "23505", message: "duplicate key" };
    expect(await recordSpaceView(SPACE_ID, OWNER_ID)).toEqual({ ok: true });
  });

  it("returns FAILED on any other insert error", async () => {
    insertError = { code: "23503", message: "fk violation" };
    expect(await recordSpaceView(SPACE_ID, OWNER_ID)).toEqual({
      ok: false,
      error: "FAILED",
      message: "fk violation",
    });
  });
});
