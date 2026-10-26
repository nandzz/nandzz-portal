import { describe, it, expect } from "vitest";
import { rowFromSettings, settingsFromRow, type AgentSettingsRow } from "./settings";

const row: AgentSettingsRow = {
  enabled: true,
  agent_name: "Nina",
  agent_intro: "the receptionist of the salon",
  autonomy: { new_booking: "confirm", reschedule: "pending", cancel: "off" },
  agent_hours: { mon: [["09:00", "13:00"], ["15:00", "19:00"]], sat: [["10:00", "14:00"]] },
  takeover_pause_min: 10,
  retention_months: 3,
};

describe("agent settings mapping", () => {
  it("falls back to the table defaults without a row", () => {
    const s = settingsFromRow(null);
    expect(s).toMatchObject({ enabled: false, name: "Assistant", limitHours: false, takeoverMinutes: 5, retentionMonths: 6 });
    expect(s.autonomy).toEqual({ new_booking: "pending", reschedule: "pending", cancel: "pending" });
  });

  it("shows a split day as first start → last end, missing days as off", () => {
    const s = settingsFromRow(row);
    expect(s.limitHours).toBe(true);
    expect(s.hours.find((h) => h.day === "mon")).toEqual({ day: "mon", enabled: true, from: "09:00", to: "19:00" });
    expect(s.hours.find((h) => h.day === "tue")?.enabled).toBe(false);
  });

  it("round-trips to columns, trimming text", () => {
    const s = settingsFromRow(row);
    const out = rowFromSettings({ ...s, name: "  Nina  " });
    expect(out).toEqual({
      agent_name: "Nina",
      agent_intro: "the receptionist of the salon",
      autonomy: row.autonomy,
      agent_hours: { mon: [["09:00", "19:00"]], sat: [["10:00", "14:00"]] },
      takeover_pause_min: 10,
      retention_months: 3,
    });
  });

  it("stores null hours when not limited", () => {
    expect(rowFromSettings({ ...settingsFromRow(row), limitHours: false })?.agent_hours).toBeNull();
  });

  it("rejects bad input", () => {
    const s = settingsFromRow(row);
    expect(rowFromSettings({ ...s, name: " " })).toBeNull();
    expect(rowFromSettings({ ...s, autonomy: { ...s.autonomy, cancel: "on" as never } })).toBeNull();
    expect(rowFromSettings({ ...s, takeoverMinutes: 0 })).toBeNull();
    expect(rowFromSettings({ ...s, retentionMonths: 24 as never })).toBeNull();
    expect(rowFromSettings({ ...s, hours: s.hours.map((h) => (h.day === "mon" ? { ...h, from: "19:00", to: "09:00" } : h)) })).toBeNull();
  });
});
