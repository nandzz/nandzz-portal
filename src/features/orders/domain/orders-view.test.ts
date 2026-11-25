import { describe, expect, it } from "vitest";
import { dayLabel, groupByDay, itemsSummary, matchesFilter, matchesQuery, primaryStep, stepActions, timeWindow } from "./orders-view";

const o = (n: number, day: string, from: string | null = null) => ({ order_number: n, fulfil_on: day, fulfil_from: from });

describe("filters", () => {
  it("map statuses to the owner's buckets", () => {
    expect(matchesFilter({ status: "pending" }, "new")).toBe(true);
    expect(matchesFilter({ status: "preparing" }, "to_prepare")).toBe(true);
    expect(matchesFilter({ status: "out_for_delivery" }, "ready")).toBe(true);
    expect(matchesFilter({ status: "rejected" }, "cancelled")).toBe(true);
    expect(matchesFilter({ status: "completed" }, "active")).toBe(false);
  });

  it("search by name, number or phone", () => {
    const order = { customer_name: "Ana Rossi", customer_phone: "+39 333 123 4567", order_number: 42 };
    expect(matchesQuery(order, "rossi")).toBe(true);
    expect(matchesQuery(order, "#42")).toBe(true);
    expect(matchesQuery(order, "42")).toBe(true);
    expect(matchesQuery(order, "4567")).toBe(true);
    expect(matchesQuery(order, "#4")).toBe(false);
    expect(matchesQuery(order, "bruno")).toBe(false);
  });
});

describe("groupByDay", () => {
  it("orders days and times, untimed last", () => {
    const groups = groupByDay([o(3, "2026-11-24"), o(1, "2026-11-23", "11:00:00"), o(2, "2026-11-23", "09:30:00"), o(4, "2026-11-23")], false);
    expect(groups.map((g) => g.day)).toEqual(["2026-11-23", "2026-11-24"]);
    expect(groups[0].orders.map((x) => x.order_number)).toEqual([2, 1, 4]);
  });

  it("history reads newest first", () => {
    expect(groupByDay([o(1, "2026-11-20"), o(2, "2026-11-21")], true).map((g) => g.day)).toEqual(["2026-11-21", "2026-11-20"]);
  });
});

describe("labels", () => {
  it("relative day names", () => {
    expect(dayLabel("2026-11-22", "2026-11-22")).toEqual({ kind: "today" });
    expect(dayLabel("2026-11-23", "2026-11-22")).toEqual({ kind: "tomorrow" });
    expect(dayLabel("2026-11-21", "2026-11-22")).toEqual({ kind: "yesterday" });
    expect(dayLabel("2026-12-01", "2026-11-22")).toEqual({ kind: "date", date: "2026-12-01" });
  });

  it("time windows and item summaries", () => {
    expect(timeWindow("10:00:00", "11:30:00")).toBe("10:00–11:30");
    expect(timeWindow("10:00:00", null)).toBe("10:00");
    expect(timeWindow(null, null)).toBeNull();
    const items = [
      { name: "Pane", quantity: 1, position: 1 },
      { name: "Torta", quantity: 2, position: 0 },
      { name: "A", quantity: 1, position: 2 },
      { name: "B", quantity: 1, position: 3 },
    ];
    expect(itemsSummary(items)).toEqual({ text: "2× Torta, 1× Pane, 1× A", more: 1 });
  });
});

describe("stepActions", () => {
  it("follows the status machine per method", () => {
    expect(stepActions("pending", "pickup")).toEqual(["confirm", "reject"]);
    expect(stepActions("confirmed", "pickup")).toEqual(["start_preparing", "mark_ready", "cancel"]);
    expect(stepActions("ready", "pickup")).toEqual(["picked_up", "cancel"]);
    expect(stepActions("ready", "delivery")).toEqual(["out_for_delivery", "delivered", "cancel"]);
    expect(stepActions("out_for_delivery", "delivery")).toEqual(["delivered", "cancel"]);
    expect(stepActions("completed", "delivery")).toEqual([]);
  });
});

describe("primaryStep", () => {
  it("offers the usual next step, never reject or cancel", () => {
    expect(primaryStep("pending", "pickup")).toBe("confirm");
    expect(primaryStep("confirmed", "pickup")).toBe("start_preparing");
    expect(primaryStep("ready", "pickup")).toBe("picked_up");
    expect(primaryStep("ready", "delivery")).toBe("out_for_delivery");
    expect(primaryStep("out_for_delivery", "delivery")).toBe("delivered");
    expect(primaryStep("cancelled", "pickup")).toBeNull();
  });
});
