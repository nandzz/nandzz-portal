import { describe, it, expect } from "vitest";
import {
  computeAvailableSlots,
  normalizeCalendarConfig,
  validateCalendarConfig,
  zonedWallTimeToUtc,
  type Slot,
} from "./calendar";
import type { CalendarConfig, CalendarService } from "@/lib/types";

const service: CalendarService = { id: "svc_1", name: "Haircut", duration_min: 30 };

function utcConfig(overrides: Partial<CalendarConfig> = {}): CalendarConfig {
  return normalizeCalendarConfig({
    timezone: "UTC",
    buffer_min: 0,
    services: [service],
    availability: { mon: [["09:00", "11:00"]] },
    blackout_dates: [],
    ...overrides,
  });
}

// 2026-08-10 is a Monday.
const MONDAY = "2026-08-10";
const farPast = new Date("2000-01-01T00:00:00Z");

describe("computeAvailableSlots", () => {
  it("generates back-to-back slots inside the availability window", () => {
    const slots = computeAvailableSlots({
      config: utcConfig(),
      service,
      fromDate: MONDAY,
      days: 1,
      existingBookings: [],
      now: farPast,
    });
    // 09:00–11:00 in 30-min steps → 09:00, 09:30, 10:00, 10:30 = 4 slots.
    expect(slots.map((s) => s.start)).toEqual([
      "2026-08-10T09:00:00.000Z",
      "2026-08-10T09:30:00.000Z",
      "2026-08-10T10:00:00.000Z",
      "2026-08-10T10:30:00.000Z",
    ]);
  });

  it("excludes slots that overlap an existing confirmed booking", () => {
    const slots = computeAvailableSlots({
      config: utcConfig(),
      service,
      fromDate: MONDAY,
      days: 1,
      existingBookings: [
        { starts_at: "2026-08-10T09:30:00.000Z", ends_at: "2026-08-10T10:00:00.000Z" },
      ],
      now: farPast,
    });
    expect(slots.map((s) => s.start)).toEqual([
      "2026-08-10T09:00:00.000Z",
      "2026-08-10T10:00:00.000Z",
      "2026-08-10T10:30:00.000Z",
    ]);
  });

  it("honors the buffer between bookings", () => {
    const slots = computeAvailableSlots({
      config: utcConfig({ buffer_min: 30 }),
      service,
      fromDate: MONDAY,
      days: 1,
      existingBookings: [],
      now: farPast,
    });
    // step = 30 + 30 = 60 → 09:00, 10:00 (10:30 would end at 11:00 but next step lands at 11:00 > window).
    expect(slots.map((s) => s.start)).toEqual([
      "2026-08-10T09:00:00.000Z",
      "2026-08-10T10:00:00.000Z",
    ]);
  });

  it("skips blackout dates", () => {
    const slots = computeAvailableSlots({
      config: utcConfig({ blackout_dates: [MONDAY] }),
      service,
      fromDate: MONDAY,
      days: 1,
      existingBookings: [],
      now: farPast,
    });
    expect(slots).toHaveLength(0);
  });

  it("does not offer slots in the past (minLead)", () => {
    const slots = computeAvailableSlots({
      config: utcConfig(),
      service,
      fromDate: MONDAY,
      days: 1,
      existingBookings: [],
      now: new Date("2026-08-10T09:45:00Z"),
      minLeadMinutes: 0,
    });
    // Only 10:00 and 10:30 remain (09:00/09:30 are before "now").
    expect(slots.map((s) => s.start)).toEqual([
      "2026-08-10T10:00:00.000Z",
      "2026-08-10T10:30:00.000Z",
    ]);
  });

  it("offers no slots on a weekday with no availability windows", () => {
    const slots = computeAvailableSlots({
      config: utcConfig({ availability: { tue: [["09:00", "17:00"]] } }),
      service,
      fromDate: MONDAY, // Monday, but only Tuesday is configured
      days: 1,
      existingBookings: [],
      now: farPast,
    });
    expect(slots).toHaveLength(0);
  });
});

describe("zonedWallTimeToUtc", () => {
  it("converts a wall-clock time in a positive-offset zone to UTC", () => {
    // Lisbon is UTC+1 in August (WEST) → 09:00 local = 08:00 UTC.
    const utc = zonedWallTimeToUtc("2026-08-10", "09:00", "Europe/Lisbon");
    expect(utc.toISOString()).toBe("2026-08-10T08:00:00.000Z");
  });
});

describe("validateCalendarConfig", () => {
  it("flags a service with a non-positive duration", () => {
    const cfg = utcConfig({ services: [{ id: "s", name: "X", duration_min: 0 }] });
    expect(validateCalendarConfig(cfg).length).toBeGreaterThan(0);
  });

  it("flags a window whose start is after its end", () => {
    const cfg = utcConfig({ availability: { mon: [["17:00", "09:00"]] } });
    expect(validateCalendarConfig(cfg).some((e) => e.includes("before end"))).toBe(true);
  });

  it("accepts a well-formed config", () => {
    expect(validateCalendarConfig(utcConfig())).toEqual([]);
  });
});

// Keep the Slot type referenced so the import isn't tree-shaken by lint.
const _typecheck: Slot = { start: "", end: "" };
void _typecheck;
