// Pure helpers behind the Orders tab: filters, day groups, the next step an
// owner can take. I/O-free so they're unit-tested (orders-view.test.ts).

import type { FulfilmentMethod, Order, OrderItem, OrderStatus } from "../types";
import { addDays } from "./availability";
import { canTransition } from "./status";

export type OrderView = Order & { items: OrderItem[] };

export type OrderFilter = "active" | "new" | "to_prepare" | "ready" | "done" | "cancelled";

const FILTER_STATUSES: Record<OrderFilter, readonly OrderStatus[]> = {
  active: ["pending", "confirmed", "preparing", "ready", "out_for_delivery"],
  new: ["pending"],
  to_prepare: ["confirmed", "preparing"],
  ready: ["ready", "out_for_delivery"],
  done: ["completed"],
  cancelled: ["cancelled", "rejected"],
};

export const ORDER_FILTERS = Object.keys(FILTER_STATUSES) as OrderFilter[];

export function matchesFilter(o: Pick<Order, "status">, f: OrderFilter): boolean {
  return FILTER_STATUSES[f].includes(o.status);
}

/** Open views read soonest-first; history views newest-first. */
export function isHistoryFilter(f: OrderFilter): boolean {
  return f === "done" || f === "cancelled";
}

/** Case-insensitive match on customer name, phone digits or order number ("#42", "42"). */
export function matchesQuery(o: Pick<Order, "customer_name" | "customer_phone" | "order_number">, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  if (o.customer_name.toLocaleLowerCase().includes(q)) return true;
  const digits = q.replace(/\D/g, "");
  if (digits && /^#?\d+$/.test(q) && String(o.order_number) === digits) return true;
  if (digits.length >= 3 && (o.customer_phone ?? "").replace(/\D/g, "").includes(digits)) return true;
  return false;
}

export type DayGroup<T> = { day: string; orders: T[] };

/** Groups by fulfilment day; within a day, by start time (no time last), then number. */
export function groupByDay<T extends Pick<Order, "fulfil_on" | "fulfil_from" | "order_number">>(
  orders: T[],
  newestFirst: boolean,
): DayGroup<T>[] {
  const byDay = new Map<string, T[]>();
  for (const o of orders) {
    const list = byDay.get(o.fulfil_on) ?? [];
    list.push(o);
    byDay.set(o.fulfil_on, list);
  }
  const days = [...byDay.keys()].sort();
  if (newestFirst) days.reverse();
  return days.map((day) => ({
    day,
    orders: (byDay.get(day) ?? []).sort(
      (a, b) => (a.fulfil_from ?? "99").localeCompare(b.fulfil_from ?? "99") || a.order_number - b.order_number,
    ),
  }));
}

export type DayLabel = { kind: "today" | "tomorrow" | "yesterday" } | { kind: "date"; date: string };

export function dayLabel(day: string, today: string): DayLabel {
  if (day === today) return { kind: "today" };
  if (day === addDays(today, 1)) return { kind: "tomorrow" };
  if (day === addDays(today, -1)) return { kind: "yesterday" };
  return { kind: "date", date: day };
}

/** "10:00–11:30", "10:00" or null when no time was set. */
export function timeWindow(from: string | null, to: string | null): string | null {
  if (!from) return null;
  const f = from.slice(0, 5);
  return to ? `${f}–${to.slice(0, 5)}` : f;
}

/** "2× Torta, 1× Pane" — capped, with "+n" for the rest. */
export function itemsSummary(items: Pick<OrderItem, "name" | "quantity" | "position">[], max = 3): { text: string; more: number } {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  return {
    text: sorted.slice(0, max).map((i) => `${i.quantity}× ${i.name}`).join(", "),
    more: Math.max(0, sorted.length - max),
  };
}

export type StepAction =
  | "confirm"
  | "reject"
  | "start_preparing"
  | "mark_ready"
  | "out_for_delivery"
  | "picked_up"
  | "delivered"
  | "cancel";

const ACTION_TARGET: Record<StepAction, OrderStatus> = {
  confirm: "confirmed",
  reject: "rejected",
  start_preparing: "preparing",
  mark_ready: "ready",
  out_for_delivery: "out_for_delivery",
  picked_up: "completed",
  delivered: "completed",
  cancel: "cancelled",
};

export function actionTarget(a: StepAction): OrderStatus {
  return ACTION_TARGET[a];
}

/**
 * The buttons for an order, primary first. "cancel" is always last (and kept
 * out of the main row by the UI). Only moves the status machine allows.
 */
export function stepActions(status: OrderStatus, method: FulfilmentMethod): StepAction[] {
  const order: StepAction[] =
    status === "pending"
      ? ["confirm", "reject"]
      : status === "confirmed"
        ? ["start_preparing", "mark_ready"]
        : status === "preparing"
          ? ["mark_ready"]
          : status === "ready"
            ? method === "delivery"
              ? ["out_for_delivery", "delivered"]
              : ["picked_up"]
            : status === "out_for_delivery"
              ? ["delivered"]
              : [];
  const allowed = order.filter((a) => canTransition(status, ACTION_TARGET[a], method));
  if (canTransition(status, "cancelled", method) && status !== "pending") allowed.push("cancel");
  return allowed;
}

/** The one-tap step the list offers for an order, or null (reject/cancel need a reason). */
export function primaryStep(status: OrderStatus, method: FulfilmentMethod): StepAction | null {
  return stepActions(status, method).find((a) => a !== "cancel" && a !== "reject") ?? null;
}
