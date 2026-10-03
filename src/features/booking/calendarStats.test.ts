import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarConfig, CalendarService } from "@/lib/types";
import { normalizeCalendarConfig } from "@/lib/widgets/calendar";
import {
  buildCapacity,
  buildForecast,
  buildOverview,
  pickReferenceService,
  type OverviewBookingRow,
  type OverviewSegment,
} from "./calendarStats";

const A: CalendarService = { id: "a", name: "Nails", duration_min: 30, price_cents: 1000 };
const B: CalendarService = { id: "b", name: "Cut", duration_min: 60, price_cents: 2000 };

function cfg(patch: Partial<CalendarConfig> = {}): CalendarConfig {
  return normalizeCalendarConfig({
    timezone: "UTC",
    buffer_min: 0,
    services: [A, B],
    availability: {
      mon: [["09:00", "17:00"]],
      tue: [["09:00", "17:00"]],
      wed: [["09:00", "17:00"]],
      thu: [["09:00", "17:00"]],
      fri: [["09:00", "17:00"]],
    },
    ...patch,
  });
}

let seq = 0;
function bk(startIso: string, endIso: string, patch: Partial<OverviewBookingRow> = {}): OverviewBookingRow {
  const min = (Date.parse(endIso) - Date.parse(startIso)) / 60_000;
  return {
    id: `b${++seq}`,
    status: "confirmed",
    starts_at: startIso,
    ends_at: endIso,
    price_cents: 1000,
    service_id: "a",
    service_name: "Nails",
    duration_min: min,
    staff_id: null,
    services: null,
    ...patch,
  };
}

function ctx(config: CalendarConfig, now: string, segments: OverviewSegment[] = [], locale = "en-US") {
  return { config, locationId: null, timezone: config.timezone, segments, locale, now: new Date(now) };
}

// 2026-10-05 is a Monday.
const MON_8AM = "2026-10-05T08:00:00Z";

describe("buildOverview — top services split", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MON_8AM));
  });
  afterEach(() => vi.useRealTimers());

  it("splits multi-service bookings into per-service counts and revenue", () => {
    const multi = bk("2026-10-05T10:00:00Z", "2026-10-05T11:30:00Z", {
      service_name: "Nails + Cut",
      price_cents: 3000,
      services: [
        { service_id: "a", name: "Nails", duration_min: 30, price_cents: 1000 },
        { service_id: "b", name: "Cut", duration_min: 60, price_cents: 2000 },
      ],
    });
    const single = bk("2026-10-05T12:00:00Z", "2026-10-05T12:30:00Z");
    const data = buildOverview([multi, single], "UTC", "€", null, "en-US", "month", {
      config: cfg(),
      locationId: null,
      now: new Date(MON_8AM),
    });
    expect(data.services).toEqual([
      { name: "Nails", count: 2, revenueCents: 2000 },
      { name: "Cut", count: 1, revenueCents: 2000 },
    ]);
    expect(data.services.some((s) => s.name.includes("+"))).toBe(false);
    expect(data.totals.revenueCents).toBe(4000);
    expect(data.capacity.days).toHaveLength(7);
    expect(data.capacity.referenceService).toEqual({ name: "Nails", durationMin: 30 });
  });
});

describe("pickReferenceService", () => {
  it("picks the most-booked service still offered, else the first", () => {
    const rows = [
      bk("2026-10-01T10:00:00Z", "2026-10-01T11:00:00Z", { service_id: "b", service_name: "Cut" }),
      bk("2026-10-02T10:00:00Z", "2026-10-02T11:00:00Z", { service_id: "b", service_name: "Cut" }),
      bk("2026-10-02T12:00:00Z", "2026-10-02T12:30:00Z", { service_id: "gone", service_name: "Old" }),
      bk("2026-10-02T13:00:00Z", "2026-10-02T13:30:00Z", { service_id: "gone", service_name: "Old" }),
      bk("2026-10-02T14:00:00Z", "2026-10-02T14:30:00Z", { service_id: "gone", service_name: "Old" }),
    ];
    expect(pickReferenceService(rows, [A, B])?.id).toBe("b");
    expect(pickReferenceService([], [A, B])?.id).toBe("a");
    expect(pickReferenceService(rows, [])).toBeNull();
  });
});

describe("buildCapacity — no staff", () => {
  it("measures open/booked minutes and counts fits in the free gaps", () => {
    const rows = [bk("2026-10-05T10:00:00Z", "2026-10-05T11:00:00Z")];
    const cap = buildCapacity(rows, ctx(cfg(), MON_8AM), A);
    const mon = cap.days[0];
    expect(mon.date).toBe("2026-10-05");
    expect(mon).toMatchObject({ openMin: 480, bookedMin: 60, closed: false });
    // 09–10 → 2, 11–17 → 12.
    expect(mon.fits).toBe(14);
    // Tue..Fri fully open; Sat/Sun closed.
    expect(cap.days[1]).toMatchObject({ openMin: 480, bookedMin: 0, fits: 16 });
    expect(cap.days[5]).toMatchObject({ date: "2026-10-10", openMin: 0, fits: 0, closed: true });
    expect(cap.days[6].closed).toBe(true);
  });

  it("closes blackout days", () => {
    const cap = buildCapacity([], ctx(cfg({ blackout_dates: ["2026-10-06"] }), MON_8AM), A);
    expect(cap.days[1]).toMatchObject({ date: "2026-10-06", openMin: 0, closed: true, fits: 0 });
  });

  it("respects the buffer around bookings", () => {
    const rows = [bk("2026-10-05T10:00:00Z", "2026-10-05T11:00:00Z")];
    const cap = buildCapacity(rows, ctx(cfg({ buffer_min: 15 }), MON_8AM), A);
    // 09:00–09:45 → 1 (needs 15 min before the 10:00 booking);
    // 11:15–17:00 → 8 (30-min slots separated by 15-min buffers).
    expect(cap.days[0].fits).toBe(9);
    // An empty day: floor((480 + 15) / 45) = 11.
    expect(cap.days[1].fits).toBe(11);
  });

  it("only counts time after now for today's fits", () => {
    const cap = buildCapacity([], ctx(cfg(), "2026-10-05T12:00:00Z"), A);
    expect(cap.days[0]).toMatchObject({ openMin: 480, fits: 10 });
  });

  it("anchors windows to the owner timezone and localizes labels", () => {
    const config = cfg({ timezone: "Europe/Rome" });
    // 07:00Z = 09:00 in Rome (CEST).
    const rows = [bk("2026-10-05T07:00:00Z", "2026-10-05T08:00:00Z")];
    const cap = buildCapacity(rows, ctx(config, "2026-10-05T06:00:00Z", [], "it"), A);
    expect(cap.days[0]).toMatchObject({ date: "2026-10-05", openMin: 480, bookedMin: 60, label: "lun 5" });
  });

  it("returns a null reference service and zero fits with no services", () => {
    const cap = buildCapacity([], ctx(cfg({ services: [] }), MON_8AM), null);
    expect(cap.referenceService).toBeNull();
    expect(cap.days[0]).toMatchObject({ openMin: 480, fits: 0 });
  });
});

describe("buildCapacity — with staff", () => {
  const staffCfg = () =>
    cfg({
      services: [{ ...A, staff_ids: ["s1"] }, B],
      staff: [
        { id: "s1", name: "Ana", availability: { mon: [["09:00", "13:00"]], wed: [["09:00", "13:00"]] } },
        // Works past closing — only the overlap with business hours counts.
        {
          id: "s2",
          name: "Bea",
          availability: { mon: [["12:00", "20:00"]], wed: [["12:00", "20:00"]] },
          blackout_dates: ["2026-10-07"],
        },
      ],
    });

  it("sums staff ∩ business windows and per-staff busy time (segments + unassigned)", () => {
    const single = bk("2026-10-05T09:00:00Z", "2026-10-05T10:00:00Z", { staff_id: "s1" });
    const multi = bk("2026-10-05T10:00:00Z", "2026-10-05T13:00:00Z", {
      staff_id: "s1",
      services: [
        { service_id: "a", name: "Nails", duration_min: 30, price_cents: 1000, staff_id: "s1" },
        { service_id: "b", name: "Cut", duration_min: 60, price_cents: 2000, staff_id: "s2" },
      ],
    });
    const unassigned = bk("2026-10-05T14:00:00Z", "2026-10-05T14:30:00Z", { staff_id: null });
    const segments: OverviewSegment[] = [
      { booking_id: multi.id, staff_id: "s1", starts_at: "2026-10-05T10:00:00Z", ends_at: "2026-10-05T10:30:00Z" },
      { booking_id: multi.id, staff_id: "s2", starts_at: "2026-10-05T12:00:00Z", ends_at: "2026-10-05T13:00:00Z" },
    ];
    const cap = buildCapacity([single, multi, unassigned], ctx(staffCfg(), MON_8AM, segments), {
      ...A,
      staff_ids: ["s1"],
    });
    const mon = cap.days[0];
    // s1 09–13 (240) + s2 12–17 (300).
    expect(mon.openMin).toBe(540);
    // s1: 60 + 30, s2: 60 (segment, not the booking's whole span), unassigned: 30.
    expect(mon.bookedMin).toBe(180);
    // Only s1 can do Nails: 10:30–13:00 → 5.
    expect(mon.fits).toBe(5);
    // Wed: s2 is off → only s1's 240.
    expect(cap.days[2]).toMatchObject({ date: "2026-10-07", openMin: 240 });
    // Tue: no staff windows → closed even though the business is open.
    expect(cap.days[1]).toMatchObject({ openMin: 0, closed: true });
  });

  it("treats every staff member as eligible when the service has no staff_ids", () => {
    const cap = buildCapacity([], ctx(staffCfg(), MON_8AM), B);
    // s1 240 → 4, s2 300 → 5.
    expect(cap.days[0].fits).toBe(9);
  });
});

describe("buildForecast", () => {
  it("splits this month's revenue and values the remaining free capacity", () => {
    // Thu 2026-10-15 12:00Z.
    const now = "2026-10-15T12:00:00Z";
    const rows = [
      bk("2026-10-05T10:00:00Z", "2026-10-05T11:00:00Z", { price_cents: 3000 }),
      bk("2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z", { price_cents: 2000 }),
      bk("2026-09-10T10:00:00Z", "2026-09-10T11:00:00Z", { price_cents: 1000 }),
      bk("2026-10-21T10:00:00Z", "2026-10-21T11:00:00Z", { price_cents: null }),
    ];
    const f = buildForecast(rows, ctx(cfg(), now));
    expect(f.monthLabel).toBe("October");
    expect(f.earnedCents).toBe(3000);
    expect(f.bookedCents).toBe(2000);
    expect(f.avgTicketCents).toBe(2000);
    // Free minutes: Thu after noon 300 + Fri 480 + week of 19th (2400 − 120
    // booked) + week of 26th 2400 = 5460; value = 6000¢ / 180 min.
    expect(f.potentialCents).toBe(Math.round((5460 * 6000) / 180));
  });

  it("reports zero potential without priced history", () => {
    const f = buildForecast([], ctx(cfg(), "2026-10-15T12:00:00Z", [], "it"));
    expect(f).toMatchObject({ monthLabel: "ottobre", earnedCents: 0, bookedCents: 0, potentialCents: 0, avgTicketCents: 0 });
  });
});
