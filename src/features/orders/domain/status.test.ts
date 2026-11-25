import { describe, expect, it } from "vitest";
import { canEditItems, canTransition, isClosed, nextStatuses } from "./status";

describe("order status machine (mirror of orders_private.can_transition)", () => {
  it("pending can be confirmed, rejected or cancelled", () => {
    expect(nextStatuses("pending", "pickup")).toEqual(["confirmed", "cancelled", "rejected"]);
  });

  it("out_for_delivery exists only for delivery orders", () => {
    expect(canTransition("confirmed", "out_for_delivery", "pickup")).toBe(false);
    expect(canTransition("confirmed", "out_for_delivery", "delivery")).toBe(true);
    expect(canTransition("ready", "out_for_delivery", "delivery")).toBe(true);
    expect(nextStatuses("ready", "pickup")).toEqual(["completed", "cancelled"]);
  });

  it("preparing is optional", () => {
    expect(canTransition("confirmed", "ready", "pickup")).toBe(true);
    expect(canTransition("confirmed", "completed", "pickup")).toBe(true);
  });

  it("closed orders never move", () => {
    for (const s of ["completed", "cancelled", "rejected"] as const) {
      expect(isClosed(s)).toBe(true);
      expect(nextStatuses(s, "delivery")).toEqual([]);
    }
  });

  it("no going back", () => {
    expect(canTransition("ready", "preparing", "pickup")).toBe(false);
    expect(canTransition("confirmed", "pending", "pickup")).toBe(false);
    expect(canTransition("pending", "ready", "pickup")).toBe(false);
  });

  it("items are editable only before work starts", () => {
    expect(canEditItems("pending")).toBe(true);
    expect(canEditItems("confirmed")).toBe(true);
    expect(canEditItems("preparing")).toBe(false);
  });
});
