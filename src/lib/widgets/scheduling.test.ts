import { describe, it, expect } from "vitest";
import {
  computeSegmentedSlots,
  layoutServiceSegments,
  resolveSegmentPlan,
  staffAvailabilityForWindow,
  type ServiceChoice,
} from "./calendar";
import { normalizeCalendarConfig } from "./calendar";
import type { CalendarConfig, CalendarService, StaffMember } from "@/lib/types";

// 2026-08-10 is a Monday.
const MONDAY = "2026-08-10";
const farPast = new Date("2000-01-01T00:00:00Z");

const alice: StaffMember = {
  id: "st_alice",
  name: "Alice",
  availability: { mon: [["09:00", "12:00"]] },
};
const bob: StaffMember = {
  id: "st_bob",
  name: "Bob",
  availability: { mon: [["09:00", "12:00"]] },
};

// Haircut can only be done by Alice; Color only by Bob — deliberately NO common
// staff, the case the old intersection model blocked entirely.
const haircut: CalendarService = { id: "svc_hair", name: "Haircut", duration_min: 30, staff_ids: [alice.id] };
const color: CalendarService = { id: "svc_color", name: "Color", duration_min: 30, staff_ids: [bob.id] };

function cfg(overrides: Partial<CalendarConfig> = {}): CalendarConfig {
  return normalizeCalendarConfig({
    timezone: "UTC",
    buffer_min: 0,
    services: [haircut, color],
    staff: [alice, bob],
    availability: { mon: [["09:00", "12:00"]] },
    blackout_dates: [],
    ...overrides,
  });
}

const anyChoice = (s: CalendarService): ServiceChoice => ({ service: s });

describe("layoutServiceSegments", () => {
  it("stacks sequential services back-to-back and sums the duration", () => {
    const { segments, totalMin } = layoutServiceSegments([anyChoice(haircut), anyChoice(color)], true);
    expect(segments.map((s) => s.offsetMin)).toEqual([0, 30]);
    expect(totalMin).toBe(60);
  });

  it("overlaps parallel services at the start and uses the max duration", () => {
    const c2: CalendarService = { ...color, parallel: true, duration_min: 45 };
    const { segments, totalMin } = layoutServiceSegments(
      [anyChoice({ ...haircut, parallel: true }), anyChoice(c2)],
      true
    );
    expect(segments.map((s) => s.offsetMin)).toEqual([0, 0]);
    expect(totalMin).toBe(45);
  });

  it("ignores the parallel flag for a single-resource business (no staff)", () => {
    const { segments, totalMin } = layoutServiceSegments(
      [anyChoice({ ...haircut, parallel: true }), anyChoice({ ...color, parallel: true })],
      false
    );
    expect(segments.map((s) => s.offsetMin)).toEqual([0, 30]);
    expect(totalMin).toBe(60);
  });
});

describe("computeSegmentedSlots — the previously-blocked case", () => {
  it("offers slots for two services with no common staff (sequential)", () => {
    const slots = computeSegmentedSlots({
      config: cfg(),
      choices: [anyChoice(haircut), anyChoice(color)],
      fromDate: MONDAY,
      days: 1,
      existingBusy: [],
      now: farPast,
    });
    // 60-min booking in 09:00–12:00, 60-min steps → 09:00, 10:00, 11:00.
    expect(slots.map((s) => s.start)).toEqual([
      "2026-08-10T09:00:00.000Z",
      "2026-08-10T10:00:00.000Z",
      "2026-08-10T11:00:00.000Z",
    ]);
  });

  it("respects a specific per-service staff choice", () => {
    // Asking Bob to do the Haircut (which only Alice can perform) is impossible.
    const slots = computeSegmentedSlots({
      config: cfg(),
      choices: [{ service: haircut, staffId: bob.id }, anyChoice(color)],
      fromDate: MONDAY,
      days: 1,
      existingBusy: [],
      now: farPast,
    });
    expect(slots).toHaveLength(0);
  });

  it("skips a start when the segment's staff is already busy", () => {
    // Alice busy 09:00–09:30 → the Haircut segment of a 09:00 start can't run.
    const slots = computeSegmentedSlots({
      config: cfg(),
      choices: [anyChoice(haircut), anyChoice(color)],
      fromDate: MONDAY,
      days: 1,
      existingBusy: [
        { staff_id: alice.id, starts_at: "2026-08-10T09:00:00.000Z", ends_at: "2026-08-10T09:30:00.000Z" },
      ],
      now: farPast,
    });
    expect(slots.map((s) => s.start)).toEqual([
      "2026-08-10T10:00:00.000Z",
      "2026-08-10T11:00:00.000Z",
    ]);
  });
});

describe("computeSegmentedSlots — parallel services", () => {
  it("runs two parallel services concurrently with distinct staff", () => {
    const slots = computeSegmentedSlots({
      config: cfg({
        services: [{ ...haircut, parallel: true }, { ...color, parallel: true }],
      }),
      choices: [anyChoice({ ...haircut, parallel: true }), anyChoice({ ...color, parallel: true })],
      fromDate: MONDAY,
      days: 1,
      existingBusy: [],
      now: farPast,
    });
    // 30-min concurrent booking, 30-min steps in 09:00–12:00 → 6 slots.
    expect(slots).toHaveLength(6);
    expect(slots[0].start).toBe("2026-08-10T09:00:00.000Z");
    expect(slots[0].end).toBe("2026-08-10T09:30:00.000Z");
  });

  it("cannot parallelize two services that only ONE person can do", () => {
    const onlyAlice1: CalendarService = { id: "a1", name: "A1", duration_min: 30, staff_ids: [alice.id], parallel: true };
    const onlyAlice2: CalendarService = { id: "a2", name: "A2", duration_min: 30, staff_ids: [alice.id], parallel: true };
    const slots = computeSegmentedSlots({
      config: cfg({ services: [onlyAlice1, onlyAlice2] }),
      choices: [anyChoice(onlyAlice1), anyChoice(onlyAlice2)],
      fromDate: MONDAY,
      days: 1,
      existingBusy: [],
      now: farPast,
    });
    expect(slots).toHaveLength(0);
  });
});

describe("resolveSegmentPlan", () => {
  it("resolves a concrete per-segment staff plan for a valid start", () => {
    const res = resolveSegmentPlan({
      config: cfg(),
      choices: [anyChoice(haircut), anyChoice(color)],
      startIso: "2026-08-10T10:00:00.000Z",
      existingBusy: [],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.totalMin).toBe(60);
    expect(res.segments).toHaveLength(2);
    expect(res.segments[0]).toMatchObject({ service_id: haircut.id, offset_min: 0, staff_ids: [alice.id] });
    expect(res.segments[1]).toMatchObject({ service_id: color.id, offset_min: 30, staff_ids: [bob.id] });
  });

  it("returns OUT_OF_HOURS for a start the booking can't fit around", () => {
    const res = resolveSegmentPlan({
      config: cfg(),
      choices: [anyChoice(haircut), anyChoice(color)],
      startIso: "2026-08-10T11:30:00.000Z", // 60-min booking would run to 12:30, past close
      existingBusy: [],
    });
    expect(res).toEqual({ ok: false, reason: "OUT_OF_HOURS" });
  });

  it("returns STAFF_UNAVAILABLE when a segment's staff is taken", () => {
    const res = resolveSegmentPlan({
      config: cfg(),
      choices: [anyChoice(haircut), anyChoice(color)],
      startIso: "2026-08-10T10:00:00.000Z",
      existingBusy: [
        { staff_id: alice.id, starts_at: "2026-08-10T10:00:00.000Z", ends_at: "2026-08-10T10:30:00.000Z" },
      ],
    });
    expect(res).toEqual({ ok: false, reason: "STAFF_UNAVAILABLE" });
  });

  it("orders the assigned staff first with free fallbacks behind it", () => {
    // A service any of {Alice,Bob} can do → the resolved plan lists the assigned
    // person first, then the other as a race fallback.
    const flexible: CalendarService = { id: "flex", name: "Flex", duration_min: 30 };
    const res = resolveSegmentPlan({
      config: cfg({ services: [flexible] }),
      choices: [anyChoice(flexible)],
      startIso: "2026-08-10T10:00:00.000Z",
      existingBusy: [],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.segments[0].staff_ids).toHaveLength(2);
    expect(res.segments[0].staff_ids).toEqual(expect.arrayContaining([alice.id, bob.id]));
  });
});

describe("staffAvailabilityForWindow", () => {
  // A service both can do, so eligibility never hides anyone.
  const shared: CalendarService = { id: "shared", name: "Shared", duration_min: 30 };

  it("classifies every in-scope staff member (all shown, not just eligible)", () => {
    const statuses = staffAvailabilityForWindow({
      config: cfg({ services: [shared] }),
      service: shared,
      startIso: "2026-08-10T10:00:00.000Z",
      endIso: "2026-08-10T10:30:00.000Z",
      existingBusy: [],
    });
    expect(statuses.map((s) => s.staff_id)).toEqual([alice.id, bob.id]);
    expect(statuses.every((s) => s.eligible && s.working && s.assignable)).toBe(true);
  });

  it("marks a staff member busy and points at the conflicting booking index", () => {
    const statuses = staffAvailabilityForWindow({
      config: cfg({ services: [shared] }),
      service: shared,
      startIso: "2026-08-10T10:00:00.000Z",
      endIso: "2026-08-10T10:30:00.000Z",
      existingBusy: [
        { staff_id: bob.id, starts_at: "2026-08-10T10:15:00.000Z", ends_at: "2026-08-10T10:45:00.000Z" },
      ],
    });
    const bobStatus = statuses.find((s) => s.staff_id === bob.id)!;
    expect(bobStatus.assignable).toBe(false);
    expect(bobStatus.conflict_index).toBe(0);
    const aliceStatus = statuses.find((s) => s.staff_id === alice.id)!;
    expect(aliceStatus.assignable).toBe(true);
  });

  it("flags a staff member as not working outside their hours (but still assignable)", () => {
    // Alice works 09:00–12:00; a 13:00 window is outside her hours.
    const statuses = staffAvailabilityForWindow({
      config: cfg({ services: [shared], availability: { mon: [["09:00", "18:00"]] } }),
      service: shared,
      startIso: "2026-08-10T13:00:00.000Z",
      endIso: "2026-08-10T13:30:00.000Z",
      existingBusy: [],
    });
    const aliceStatus = statuses.find((s) => s.staff_id === alice.id)!;
    expect(aliceStatus.working).toBe(false);
    // Not a time clash → the owner may still override-assign.
    expect(aliceStatus.assignable).toBe(true);
  });

  it("flags a staff member as ineligible for a service they can't perform (still shown)", () => {
    // haircut is Alice-only; Bob is ineligible but must still appear.
    const statuses = staffAvailabilityForWindow({
      config: cfg(),
      service: haircut,
      startIso: "2026-08-10T10:00:00.000Z",
      endIso: "2026-08-10T10:30:00.000Z",
      existingBusy: [],
    });
    const bobStatus = statuses.find((s) => s.staff_id === bob.id)!;
    expect(bobStatus.eligible).toBe(false);
    const aliceStatus = statuses.find((s) => s.staff_id === alice.id)!;
    expect(aliceStatus.eligible).toBe(true);
  });
});

describe("computeSegmentedSlots — single-resource business", () => {
  it("schedules sequentially with no staff configured", () => {
    const s1: CalendarService = { id: "s1", name: "S1", duration_min: 30 };
    const s2: CalendarService = { id: "s2", name: "S2", duration_min: 30 };
    const slots = computeSegmentedSlots({
      config: cfg({ services: [s1, s2], staff: [] }),
      choices: [anyChoice(s1), anyChoice(s2)],
      fromDate: MONDAY,
      days: 1,
      existingBusy: [],
      now: farPast,
    });
    // 60-min booking, 60-min steps → 3 slots; the single resource is serialized.
    expect(slots.map((s) => s.start)).toEqual([
      "2026-08-10T09:00:00.000Z",
      "2026-08-10T10:00:00.000Z",
      "2026-08-10T11:00:00.000Z",
    ]);
  });
});
