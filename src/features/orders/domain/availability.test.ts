import { describe, expect, it } from "vitest";
import { addDays, earliestDate, isAvailableOnDate, localNow, stockBadge, weekdayOf } from "./availability";
import { centsToInput, formatMoney, parseMoneyInput } from "./money";

const open = { available_from: null, available_until: null, fulfilment_weekdays: null, lead_time_hours: null };

describe("dates", () => {
  it("localNow uses the business timezone", () => {
    const at = new Date("2026-11-22T23:30:00Z"); // 00:30 next day in Rome
    expect(localNow("Europe/Rome", at)).toEqual({ date: "2026-11-23", time: "00:30" });
    expect(localNow("America/Sao_Paulo", at)).toEqual({ date: "2026-11-22", time: "20:30" });
  });

  it("addDays crosses months and DST days safely", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("weekdayOf matches Postgres dow", () => {
    expect(weekdayOf("2026-11-22")).toBe(0); // Sunday
    expect(weekdayOf("2026-11-24")).toBe(2); // Tuesday
  });
});

describe("isAvailableOnDate", () => {
  it("respects the date window and weekdays", () => {
    const p = { available_from: "2026-12-01", available_until: "2026-12-24", fulfilment_weekdays: [5, 6] };
    expect(isAvailableOnDate(p, "2026-11-28")).toBe(false); // before window
    expect(isAvailableOnDate(p, "2026-12-04")).toBe(true); // Friday
    expect(isAvailableOnDate(p, "2026-12-03")).toBe(false); // Thursday
    expect(isAvailableOnDate(p, "2026-12-26")).toBe(false); // after window
  });

  it("empty weekday list means every day", () => {
    expect(isAvailableOnDate({ ...open, fulfilment_weekdays: [] }, "2026-12-03")).toBe(true);
  });
});

describe("earliestDate", () => {
  const now = new Date("2026-11-22T10:00:00Z"); // 11:00 in Rome, Sunday

  it("adds the default or product lead time", () => {
    expect(earliestDate(open, 24, "Europe/Rome", now)).toBe("2026-11-23");
    expect(earliestDate({ ...open, lead_time_hours: 72 }, 24, "Europe/Rome", now)).toBe("2026-11-25");
    expect(earliestDate({ ...open, lead_time_hours: 0 }, 24, "Europe/Rome", now)).toBe("2026-11-22");
  });

  it("jumps to the window start and the next allowed weekday", () => {
    expect(earliestDate({ ...open, available_from: "2026-12-10" }, 24, "Europe/Rome", now)).toBe("2026-12-10");
    expect(earliestDate({ ...open, fulfilment_weekdays: [6] }, 24, "Europe/Rome", now)).toBe("2026-11-28");
  });

  it("returns null once the season is over", () => {
    expect(earliestDate({ ...open, available_until: "2026-11-22" }, 24, "Europe/Rome", now)).toBeNull();
  });
});

describe("stockBadge", () => {
  const base = { status: "active" as const, stock_mode: "unlimited" as const, stock_qty: null, daily_capacity: null, available_until: null };
  it("covers every state", () => {
    expect(stockBadge({ ...base, status: "draft" }, "2026-11-22")).toEqual({ kind: "draft" });
    expect(stockBadge({ ...base, status: "archived" }, "2026-11-22")).toEqual({ kind: "archived" });
    expect(stockBadge({ ...base, available_until: "2026-11-21" }, "2026-11-22")).toEqual({ kind: "ended" });
    expect(stockBadge({ ...base, stock_mode: "stock", stock_qty: 0 }, "2026-11-22")).toEqual({ kind: "sold_out" });
    expect(stockBadge({ ...base, stock_mode: "stock", stock_qty: 4 }, "2026-11-22")).toEqual({ kind: "in_stock", count: 4 });
    expect(stockBadge({ ...base, stock_mode: "daily", daily_capacity: 10 }, "2026-11-22")).toEqual({ kind: "daily", capacity: 10 });
    expect(stockBadge(base, "2026-11-22")).toEqual({ kind: "unlimited" });
  });
});

describe("money", () => {
  it("parses what owners type", () => {
    expect(parseMoneyInput("12")).toBe(1200);
    expect(parseMoneyInput("12.5")).toBe(1250);
    expect(parseMoneyInput("12,50")).toBe(1250);
    expect(parseMoneyInput("€ 4,90")).toBe(490);
    expect(parseMoneyInput("1.250,00")).toBe(125000);
    expect(parseMoneyInput("1,250.00")).toBe(125000);
    expect(parseMoneyInput("1.250")).toBe(125000);
    expect(parseMoneyInput("0")).toBe(0);
  });

  it("rejects junk and huge amounts", () => {
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("99999999999")).toBeNull();
  });

  it("formats with the locale and round-trips the editor value", () => {
    expect(formatMoney(1250, "eur", "it")).toMatch(/12,50/);
    expect(centsToInput(1250)).toBe("12.50");
    expect(parseMoneyInput(centsToInput(99))).toBe(99);
  });
});
