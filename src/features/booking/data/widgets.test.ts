import { describe, it, expect, vi, beforeEach } from "vitest";

let entitlements: { hasWidgets: boolean };
let instanceRows: unknown[] | null;
let catalogRows: unknown[] | null;

function adminBuilder(table: string) {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  // Reads terminate on `.order(...)` (thenable) except the per-id lookups that
  // end on `.maybeSingle()`.
  b.order = async () => ({
    data: table === "widget_catalog" ? catalogRows : instanceRows,
  });
  b.maybeSingle = async () => ({
    data: (instanceRows ?? [])[0] ?? null,
  });
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (t: string) => adminBuilder(t) }),
}));

vi.mock("@/lib/plan", () => ({
  getUserEntitlements: async () => entitlements,
}));

import {
  getProfileWidgets,
  getPublicCalendar,
  getOwnerWidgets,
  getWidgetCatalog,
} from "./widgets";

beforeEach(() => {
  entitlements = { hasWidgets: true };
  instanceRows = [
    { id: "i1", user_id: "u1", enabled: true, catalog: { id: "c1" } },
  ];
  catalogRows = [{ id: "c1", slug: "calendar", active: true }];
});

describe("getProfileWidgets", () => {
  it("returns [] when the owner's plan lacks widgets", async () => {
    entitlements = { hasWidgets: false };
    const res = await getProfileWidgets("u1");
    expect(res).toEqual([]);
  });

  it("stamps has_access:true on each enabled instance when entitled", async () => {
    const res = await getProfileWidgets("u1");
    expect(res).toHaveLength(1);
    expect(res[0].has_access).toBe(true);
  });
});

describe("getPublicCalendar", () => {
  it("returns null when the plan lacks widgets", async () => {
    entitlements = { hasWidgets: false };
    const res = await getPublicCalendar("u1");
    expect(res).toBeNull();
  });

  it("returns the instance with has_access:true when entitled", async () => {
    const res = await getPublicCalendar("u1");
    expect(res?.has_access).toBe(true);
  });
});

describe("getOwnerWidgets", () => {
  it("returns instances stamped with the owner's plan access (even when false)", async () => {
    entitlements = { hasWidgets: false };
    const res = await getOwnerWidgets("u1");
    expect(res).toHaveLength(1);
    expect(res[0].has_access).toBe(false);
  });
});

describe("getWidgetCatalog", () => {
  it("returns the active catalog rows", async () => {
    const res = await getWidgetCatalog();
    expect(res).toHaveLength(1);
  });
});
