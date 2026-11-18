import { describe, it, expect, vi, beforeEach } from "vitest";

const INSTANCE_ID = "22222222-2222-4222-8222-222222222222";

let mockUser: { id: string } | null;
let existing: { id: string; catalog: { slug: string } | null } | null;
let updateResult: { data: unknown; error: { message: string } | null };
let capturedUpdate: Record<string, unknown> | null;

function serverBuilder() {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.maybeSingle = async () => ({ data: existing });
  b.update = (patch: Record<string, unknown>) => {
    capturedUpdate = patch;
    const u: Record<string, unknown> = {};
    u.eq = () => u;
    u.select = () => u;
    u.single = async () => updateResult;
    return u;
  };
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
    from: () => serverBuilder(),
  }),
}));

import { updateWidgetInstance } from "./update-widget-instance";

beforeEach(() => {
  mockUser = { id: "user_1" };
  existing = { id: INSTANCE_ID, catalog: { slug: "calendar" } };
  updateResult = { data: { id: INSTANCE_ID, enabled: true }, error: null };
  capturedUpdate = null;
});

describe("updateWidgetInstance", () => {
  it("rejects a non-uuid instanceId", async () => {
    const res = await updateWidgetInstance({ instanceId: "nope", enabled: true });
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  it("returns UNAUTHENTICATED without a user", async () => {
    mockUser = null;
    const res = await updateWidgetInstance({ instanceId: INSTANCE_ID, enabled: true });
    expect(res).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("returns NOT_FOUND when the instance isn't the caller's", async () => {
    existing = null;
    const res = await updateWidgetInstance({ instanceId: INSTANCE_ID, enabled: true });
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("returns NOTHING_TO_UPDATE when no fields are supplied", async () => {
    const res = await updateWidgetInstance({ instanceId: INSTANCE_ID });
    expect(res).toEqual({ ok: false, error: "NOTHING_TO_UPDATE" });
  });

  it("toggles the enabled flag and returns the row", async () => {
    const res = await updateWidgetInstance({ instanceId: INSTANCE_ID, enabled: true });
    expect(res.ok).toBe(true);
    expect(capturedUpdate).toEqual({ enabled: true });
  });

  it("passes non-calendar config straight through", async () => {
    existing = { id: INSTANCE_ID, catalog: { slug: "other" } };
    const res = await updateWidgetInstance({
      instanceId: INSTANCE_ID,
      config: { enabled: false, foo: "bar" },
    });
    expect(res.ok).toBe(true);
    expect(capturedUpdate).toEqual({ config: { enabled: false, foo: "bar" } });
  });

  it("returns FAILED when the update errors", async () => {
    updateResult = { data: null, error: { message: "boom" } };
    const res = await updateWidgetInstance({ instanceId: INSTANCE_ID, enabled: true });
    expect(res).toEqual({ ok: false, error: "FAILED", message: "boom" });
  });
});
