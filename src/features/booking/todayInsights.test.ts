import { describe, expect, it } from "vitest";
import { buildCustomerInsight, type HistoryRow } from "./todayInsights";

// Today = Sunday 2026-10-25 in Europe/Rome (the DST switch day: 25 hours long).
const DAY = {
  dayStart: "2026-10-24T22:00:00.000Z",
  dayEnd: "2026-10-25T23:00:00.000Z",
  timezone: "Europe/Rome",
};

let seq = 0;
function h(starts_at: string, patch: Partial<HistoryRow> = {}): HistoryRow {
  return {
    id: `h${++seq}`,
    starts_at,
    status: "confirmed",
    service_id: "a",
    service_name: "Nails",
    services: null,
    staff_name: "Ana",
    price_cents: 2000,
    notes: null,
    ...patch,
  };
}

describe("buildCustomerInsight", () => {
  it("treats a customer with only today's booking as new", () => {
    const insight = buildCustomerInsight([h("2026-10-25T08:00:00+00:00", { notes: "First time" })], DAY);
    expect(insight).toMatchObject({
      pastVisits: 0,
      spentCents: 0,
      cancelled: 0,
      firstVisit: null,
      lastVisit: null,
      nextVisit: null,
      avgGapDays: null,
      topStaff: null, // a single visit isn't a preference yet
      usualDaypart: null,
      usualWeekday: null,
      notes: [], // today's own note is shown on the appointment, not as history
      recent: [],
    });
    expect(insight.topServices).toEqual([{ name: "Nails", count: 1 }]);
  });

  it("counts a booking at exactly local midnight as today, whatever the offset format", () => {
    const insight = buildCustomerInsight([h("2026-10-24T22:00:00+00:00")], DAY);
    expect(insight.pastVisits).toBe(0);
    expect(insight.lastVisit).toBeNull();
  });

  it("rolls up visits, spend, habits, notes and the next booked visit", () => {
    // Newest first, as fetchTodayData reads them. Saturdays, 09:30 local.
    const nov7 = h("2026-11-07T08:30:00Z", { service_name: "Polish", staff_name: null });
    const oct31 = h("2026-10-31T08:30:00Z", { service_name: "Polish", staff_name: null });
    const today = h("2026-10-25T08:00:00+00:00", { notes: "Today's note" });
    const oct17 = h("2026-10-17T07:30:00Z", {
      price_cents: 3000,
      notes: "Allergic to acetone",
      services: [
        { service_id: "a", name: "Nails", duration_min: 30, price_cents: 2000, staff_id: "s1", staff_name: "Ana" },
        { service_id: "p", name: "Polish", duration_min: 30, price_cents: 1000, staff_id: "s2", staff_name: "Bea" },
      ],
    });
    const oct10 = h("2026-10-10T07:30:00Z", { status: "cancelled", notes: "Running late" });
    const oct3 = h("2026-10-03T07:30:00Z");
    const sep19 = h("2026-09-19T07:30:00Z", { notes: "Prefers short nails" });

    const insight = buildCustomerInsight([nov7, oct31, today, oct17, oct10, oct3, sep19], DAY);

    expect(insight.pastVisits).toBe(3);
    expect(insight.spentCents).toBe(3000 + 2000 + 2000);
    expect(insight.cancelled).toBe(1);
    expect(insight.firstVisit).toBe(sep19.starts_at);
    expect(insight.lastVisit).toBe(oct17.starts_at);
    expect(insight.nextVisit).toBe(oct31.starts_at); // the soonest one after today
    expect(insight.avgGapDays).toBe(14); // Sep 19 → Oct 17 over 2 gaps

    // Multi-service bookings count once per service line.
    expect(insight.topServices).toEqual([
      { name: "Nails", count: 4 },
      { name: "Polish", count: 3 },
    ]);
    // Ana on 4 of the 4 visits that had any staff (Bea once).
    expect(insight.topStaff).toEqual({ name: "Ana", count: 4, of: 4 });

    // 5 of 6 confirmed visits on a Saturday (index 5), all in the morning.
    expect(insight.usualWeekday).toBe(5);
    expect(insight.usualDaypart).toBe("morning");

    // Notes from before today, newest first, cancelled bookings included.
    expect(insight.notes.map((n) => n.text)).toEqual(["Allergic to acetone", "Running late", "Prefers short nails"]);

    expect(insight.recent).toEqual([
      { id: oct17.id, starts_at: oct17.starts_at, services: "Nails, Polish", price_cents: 3000 },
      { id: oct3.id, starts_at: oct3.starts_at, services: "Nails", price_cents: 2000 },
      { id: sep19.id, starts_at: sep19.starts_at, services: "Nails", price_cents: 2000 },
    ]);
  });

  it("reads habits in the location's timezone", () => {
    // 16:30 UTC = 18:30 in Rome (CEST): evening, not afternoon.
    const rows = [h("2026-10-17T16:30:00Z"), h("2026-10-10T16:30:00Z")];
    expect(buildCustomerInsight(rows, DAY).usualDaypart).toBe("evening");
  });

  it("leaves habits empty when there's no clear pattern", () => {
    const rows = [
      h("2026-10-23T07:30:00Z"), // Fri morning
      h("2026-10-15T12:30:00Z"), // Thu afternoon
      h("2026-10-06T17:30:00Z"), // Tue evening
    ];
    const insight = buildCustomerInsight(rows, DAY);
    expect(insight.usualDaypart).toBeNull();
    expect(insight.usualWeekday).toBeNull();
  });
});
