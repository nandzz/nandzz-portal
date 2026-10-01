import { describe, it, expect, vi, beforeEach } from "vitest";

const CATALOG_ID = "11111111-1111-4111-8111-111111111111";

let mockUser: { id: string } | null;
let entitlements: { hasWidgets: boolean };
let catalogRow: { id: string; slug: string; active: boolean } | null;
let existingRow: { id: string } | null;
let insertResult: { data: { id: string } | null; error: { message: string } | null };
let aiEnabled: boolean;

function adminBuilder(table: string) {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  if (table === "widget_catalog") {
    b.single = async () => ({
      data: catalogRow,
      error: catalogRow ? null : { message: "missing" },
    });
  }
  if (table === "widget_instances") {
    b.maybeSingle = async () => ({ data: existingRow });
    b.insert = () => ({
      select: () => ({ single: async () => insertResult }),
    });
  }
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (t: string) => adminBuilder(t) }),
}));

vi.mock("@/lib/plan", () => ({
  getUserEntitlements: async () => entitlements,
}));

vi.mock("@/lib/i18n/server", () => ({
  getCurrentLocale: async () => "en",
}));

vi.mock("@/lib/featureFlags", () => ({
  getFeatureFlags: async () => ({ ai: aiEnabled }),
}));

import { createWidgetInstance } from "./create-widget-instance";

beforeEach(() => {
  mockUser = { id: "user_1" };
  entitlements = { hasWidgets: true };
  catalogRow = { id: CATALOG_ID, slug: "calendar", active: true };
  existingRow = null;
  insertResult = { data: { id: "new_instance" }, error: null };
  aiEnabled = false;
});

describe("createWidgetInstance", () => {
  it("rejects a non-uuid catalogId", async () => {
    const res = await createWidgetInstance({ catalogId: "nope" });
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  it("returns UNAUTHENTICATED without a user", async () => {
    mockUser = null;
    const res = await createWidgetInstance({ catalogId: CATALOG_ID });
    expect(res).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("returns PLAN_REQUIRED when the plan lacks widgets", async () => {
    entitlements = { hasWidgets: false };
    const res = await createWidgetInstance({ catalogId: CATALOG_ID });
    expect(res).toEqual({ ok: false, error: "PLAN_REQUIRED" });
  });

  it("returns NOT_AVAILABLE for an inactive/missing catalog entry", async () => {
    catalogRow = { id: CATALOG_ID, slug: "calendar", active: false };
    const res = await createWidgetInstance({ catalogId: CATALOG_ID });
    expect(res).toEqual({ ok: false, error: "NOT_AVAILABLE" });
  });

  it("returns the existing instance instead of a duplicate", async () => {
    existingRow = { id: "already_here" };
    const res = await createWidgetInstance({ catalogId: CATALOG_ID });
    expect(res).toEqual({ ok: true, id: "already_here" });
  });

  it("creates a hidden instance and returns its id", async () => {
    const res = await createWidgetInstance({ catalogId: CATALOG_ID });
    expect(res).toEqual({ ok: true, id: "new_instance" });
  });

  it("returns FAILED when the insert errors", async () => {
    insertResult = { data: null, error: { message: "boom" } };
    const res = await createWidgetInstance({ catalogId: CATALOG_ID });
    expect(res).toEqual({ ok: false, error: "FAILED", message: "boom" });
  });

  it("returns NOT_AVAILABLE for the agent widget while AI is off", async () => {
    catalogRow = { id: CATALOG_ID, slug: "agent", active: true };
    aiEnabled = false;
    const res = await createWidgetInstance({ catalogId: CATALOG_ID });
    expect(res).toEqual({ ok: false, error: "NOT_AVAILABLE" });
  });

  it("provisions the agent widget when AI is on", async () => {
    catalogRow = { id: CATALOG_ID, slug: "agent", active: true };
    aiEnabled = true;
    const res = await createWidgetInstance({ catalogId: CATALOG_ID });
    expect(res).toEqual({ ok: true, id: "new_instance" });
  });
});
