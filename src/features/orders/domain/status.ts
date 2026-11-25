// Order status machine. Mirrors orders_private.can_transition in
// supabase/migrations/20261122120000_orders_foundation.sql: the DB is the
// authority, this copy only decides which buttons the dashboard shows.
// Keep both in sync (status.test.ts pins the table).

import type { FulfilmentMethod, OrderStatus } from "../types";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
  "rejected",
];

export const CLOSED_STATUSES: readonly OrderStatus[] = ["completed", "cancelled", "rejected"];

const NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "rejected", "cancelled"],
  confirmed: ["preparing", "ready", "out_for_delivery", "completed", "cancelled"],
  preparing: ["ready", "out_for_delivery", "cancelled"],
  ready: ["completed", "out_for_delivery", "cancelled"],
  out_for_delivery: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  rejected: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus, method: FulfilmentMethod): boolean {
  if (to === "out_for_delivery" && method !== "delivery") return false;
  return NEXT[from].includes(to);
}

export function nextStatuses(from: OrderStatus, method: FulfilmentMethod): OrderStatus[] {
  return ORDER_STATUSES.filter((to) => canTransition(from, to, method));
}

export function isClosed(status: OrderStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

// Items can be replaced only before work starts.
export function canEditItems(status: OrderStatus): boolean {
  return status === "pending" || status === "confirmed";
}
