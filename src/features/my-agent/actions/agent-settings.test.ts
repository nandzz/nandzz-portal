import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentSettings } from "../types";

const ENTRY_ID = "3903cee0-b1f1-48b6-be4a-8bc550f5c114";

let mockUser: { id: string } | null;
let accountType: string;
let featureOn: boolean;
let dbError: { message: string } | null;
let knowledgeCount: number;
let updateResult: { id: string } | null;
// Every write the actions send, in order.
let calls: { table: string; op: string; payload?: unknown; options?: unknown; filters: [string, unknown][] }[];

function builder(table: string) {
  const call = { table, op: "", payload: undefined as unknown, options: undefined as unknown, filters: [] as [string, unknown][] };
  const q: Record<string, unknown> = {};
  const record = (op: string, payload?: unknown, options?: unknown) => {
    Object.assign(call, { op, payload, options });
    if (op !== "select") calls.push(call);
    return q;
  };
  q.upsert = (payload: unknown, options: unknown) => record("upsert", payload, options);
  q.insert = (payload: unknown) => record("insert", payload);
  q.update = (payload: unknown) => record("update", payload);
  q.delete = () => record("delete");
  q.select = (_cols: string, opts?: { head?: boolean }) => {
    if (!call.op) record("select", opts);
    return q;
  };
  q.eq = (col: string, val: unknown) => {
    call.filters.push([col, val]);
    return q;
  };
  q.maybeSingle = async () => ({ data: dbError ? null : updateResult, error: dbError });
  q.single = async () => ({ data: dbError ? null : { id: "new_id" }, error: dbError });
  // Awaited directly: upsert / delete / the count query.
  q.then = (resolve: (v: unknown) => void) =>
    resolve(call.op === "select" ? { count: knowledgeCount, error: null } : { error: dbError });
  return q;
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/flags", () => ({
  FEATURES: {
    get businessAgent() {
      return featureOn;
    },
  },
}));
vi.mock("@/lib/account/server", () => ({ getAccountType: async () => accountType }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
    from: (t: string) => builder(t),
  }),
}));

import { deleteKnowledgeEntry, saveAgentSettings, saveKnowledgeEntry, setAgentEnabled } from "./agent-settings";

const valid: AgentSettings = {
  enabled: true,
  name: " Nina ",
  intro: "the receptionist of the salon.",
  autonomy: { new_booking: "confirm", reschedule: "pending", cancel: "off" },
  limitHours: true,
  hours: (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((day) => ({
    day,
    enabled: day !== "sun",
    from: "09:00",
    to: "19:00",
  })),
  takeoverMinutes: 5,
  retentionMonths: 6,
};

beforeEach(() => {
  mockUser = { id: "owner_1" };
  accountType = "business";
  featureOn = true;
  dbError = null;
  knowledgeCount = 0;
  updateResult = { id: ENTRY_ID };
  calls = [];
});

describe("saveAgentSettings", () => {
  it("upserts the caller's row with cleaned values (never `enabled`)", async () => {
    expect(await saveAgentSettings(valid)).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    const { table, op, payload, options } = calls[0];
    expect({ table, op, options }).toEqual({ table: "agent_settings", op: "upsert", options: { onConflict: "owner_user_id" } });
    expect(payload).toMatchObject({
      owner_user_id: "owner_1",
      agent_name: "Nina",
      agent_intro: "the receptionist of the salon",
      autonomy: { new_booking: "confirm", reschedule: "pending", cancel: "off" },
      takeover_pause_min: 5,
      retention_months: 6,
    });
    expect(payload).not.toHaveProperty("enabled");
    expect((payload as { agent_hours: Record<string, unknown> }).agent_hours).not.toHaveProperty("sun");
  });

  it("drops unknown autonomy keys the client sends", async () => {
    await saveAgentSettings({ ...valid, autonomy: { ...valid.autonomy, refund: "confirm" } as never });
    expect((calls[0].payload as { autonomy: object }).autonomy).toEqual(valid.autonomy);
  });

  it("rejects invalid input before touching the database", async () => {
    for (const bad of [
      { ...valid, name: "" },
      { ...valid, name: "x".repeat(41) },
      { ...valid, intro: "x".repeat(201) },
      { ...valid, takeoverMinutes: 241 },
      { ...valid, takeoverMinutes: 2.5 },
      { ...valid, hours: valid.hours.slice(1) },
      { ...valid, hours: [null, ...valid.hours.slice(1)] as never },
      { ...valid, hours: valid.hours.map((h) => ({ ...h, from: 9 })) as never },
      { ...valid, hours: valid.hours.map((h) => ({ ...h, to: "25:00" })) },
      null as never,
    ]) {
      expect(await saveAgentSettings(bad)).toEqual({ ok: false, error: "INVALID_INPUT" });
    }
    expect(calls).toHaveLength(0);
  });

  it("needs a signed-in business account with the feature on", async () => {
    for (const setup of [() => (mockUser = null), () => (accountType = "personal"), () => (featureOn = false)]) {
      beforeEachReset();
      setup();
      expect(await saveAgentSettings(valid)).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    }
    expect(calls).toHaveLength(0);
  });

  it("reports database errors", async () => {
    dbError = { message: "boom" };
    expect(await saveAgentSettings(valid)).toEqual({ ok: false, error: "FAILED" });
  });
});

describe("setAgentEnabled", () => {
  it("upserts only the switch", async () => {
    expect(await setAgentEnabled(false)).toEqual({ ok: true });
    const payload = calls[0].payload as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["enabled", "owner_user_id", "updated_at"]);
    expect(payload).toMatchObject({ owner_user_id: "owner_1", enabled: false });
  });

  it("rejects non-booleans", async () => {
    expect(await setAgentEnabled("true" as never)).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(calls).toHaveLength(0);
  });
});

describe("saveKnowledgeEntry", () => {
  it("creates an entry for the caller", async () => {
    expect(await saveKnowledgeEntry({ title: " Prices ", body: " Cut 25 € " })).toEqual({ ok: true, id: "new_id" });
    expect(calls[0]).toMatchObject({
      table: "agent_knowledge",
      op: "insert",
      payload: { owner_user_id: "owner_1", title: "Prices", body: "Cut 25 €" },
    });
  });

  it("stops at the entry cap", async () => {
    knowledgeCount = 200;
    expect(await saveKnowledgeEntry({ title: "A", body: "B" })).toEqual({ ok: false, error: "TOO_MANY" });
    expect(calls).toHaveLength(0);
  });

  it("edits only the caller's entry", async () => {
    expect(await saveKnowledgeEntry({ id: ENTRY_ID, title: "A", body: "B" })).toEqual({ ok: true, id: ENTRY_ID });
    expect(calls[0].op).toBe("update");
    expect(calls[0].filters).toEqual([
      ["id", ENTRY_ID],
      ["owner_user_id", "owner_1"],
    ]);
  });

  it("NOT_FOUND when the entry isn't the caller's", async () => {
    updateResult = null;
    expect(await saveKnowledgeEntry({ id: ENTRY_ID, title: "A", body: "B" })).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("rejects invalid input", async () => {
    for (const bad of [
      { title: "", body: "B" },
      { title: "A", body: "   " },
      { title: "x".repeat(201), body: "B" },
      { title: "A", body: "x".repeat(8001) },
      { id: "nope", title: "A", body: "B" },
      { id: null as never, title: "A", body: "B" },
    ]) {
      expect(await saveKnowledgeEntry(bad)).toEqual({ ok: false, error: "INVALID_INPUT" });
    }
    expect(calls).toHaveLength(0);
  });
});

describe("deleteKnowledgeEntry", () => {
  it("deletes only the caller's entry", async () => {
    expect(await deleteKnowledgeEntry(ENTRY_ID)).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ table: "agent_knowledge", op: "delete" });
    expect(calls[0].filters).toEqual([
      ["id", ENTRY_ID],
      ["owner_user_id", "owner_1"],
    ]);
  });

  it("rejects a bad id and signed-out callers", async () => {
    expect(await deleteKnowledgeEntry("nope")).toEqual({ ok: false, error: "INVALID_INPUT" });
    mockUser = null;
    expect(await deleteKnowledgeEntry(ENTRY_ID)).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(calls).toHaveLength(0);
  });
});

function beforeEachReset() {
  mockUser = { id: "owner_1" };
  accountType = "business";
  featureOn = true;
}
