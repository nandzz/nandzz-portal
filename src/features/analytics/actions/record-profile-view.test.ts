import { describe, it, expect, vi, beforeEach } from "vitest";

let mockUser: { id: string } | null;
let insertError: { code?: string; message: string } | null;
let insertedRow: Record<string, unknown> | undefined;
let upsertOpts: Record<string, unknown> | undefined;
let reqHeaders: Record<string, string>;

vi.mock("next/headers", () => ({
  headers: async () => new Headers(reqHeaders),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      upsert: async (row: Record<string, unknown>, opts: Record<string, unknown>) => {
        insertedRow = row;
        upsertOpts = opts;
        return { error: insertError };
      },
    }),
  }),
}));

import { recordProfileView } from "./record-profile-view";

const PROFILE_ID = "55555555-5555-4555-9555-555555555555";
const VIEWER_ID = "66666666-6666-4666-8666-666666666666";

beforeEach(() => {
  mockUser = null;
  insertError = null;
  insertedRow = undefined;
  upsertOpts = undefined;
  reqHeaders = { "user-agent": "Mozilla/5.0", "x-forwarded-for": "1.1.1.1, 2.2.2.2" };
});

describe("recordProfileView", () => {
  it("rejects a non-uuid id", async () => {
    expect(await recordProfileView("nope")).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  it("never counts the owner", async () => {
    mockUser = { id: PROFILE_ID };
    expect(await recordProfileView(PROFILE_ID)).toEqual({ ok: false, error: "OWNER" });
    expect(insertedRow).toBeUndefined();
  });

  it("skips bots", async () => {
    reqHeaders["user-agent"] = "Googlebot/2.1";
    expect(await recordProfileView(PROFILE_ID)).toEqual({ ok: false, error: "BOT" });
  });

  it("keys signed-in visitors by user id", async () => {
    mockUser = { id: VIEWER_ID };
    expect(await recordProfileView(PROFILE_ID)).toEqual({ ok: true });
    expect(insertedRow).toMatchObject({ visitor_key: `u:${VIEWER_ID}`, viewer_id: VIEWER_ID });
  });

  it("keys anonymous visitors by a hash using the last XFF entry", async () => {
    await recordProfileView(PROFILE_ID);
    const a = insertedRow!.visitor_key as string;
    expect(a).toMatch(/^a:[0-9a-f]{64}$/);
    reqHeaders["x-forwarded-for"] = "9.9.9.9, 2.2.2.2"; // spoofed leftmost entry
    await recordProfileView(PROFILE_ID);
    expect(insertedRow!.visitor_key).toBe(a);
  });

  it("dedups repeat visits the same day with ON CONFLICT DO NOTHING", async () => {
    expect(await recordProfileView(PROFILE_ID)).toEqual({ ok: true });
    expect(upsertOpts).toEqual({ onConflict: "profile_id,visitor_key,viewed_date", ignoreDuplicates: true });
  });

  it("returns FAILED on a real write error", async () => {
    insertError = { code: "42501", message: "denied" };
    const res = await recordProfileView(PROFILE_ID);
    expect(res).toEqual({ ok: false, error: "FAILED", message: "denied" });
  });
});
