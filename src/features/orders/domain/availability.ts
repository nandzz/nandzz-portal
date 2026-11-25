// Product availability, pure and I/O-free. The DB (orders_private.write_items)
// is the authority when an order is placed; these helpers drive what the
// dashboard shows (badges, "orderable from") and, in Phase 4, what the agent
// offers. Dates are YYYY-MM-DD in the business's timezone.

import type { Product } from "../types";

export type LocalNow = { date: string; time: string };

/** Wall-clock date + HH:MM in `timeZone` at instant `at`. */
export function localNow(timeZone: string, at: Date): LocalNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** `date` + n days (calendar arithmetic, no timezone involved). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, like Postgres `extract(dow)`. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

type AvailabilityFields = Pick<Product, "available_from" | "available_until" | "fulfilment_weekdays">;

/** Inside the product's date window and on one of its weekdays. */
export function isAvailableOnDate(p: AvailabilityFields, date: string): boolean {
  if (p.available_from && date < p.available_from) return false;
  if (p.available_until && date > p.available_until) return false;
  if (p.fulfilment_weekdays && p.fulfilment_weekdays.length > 0 && !p.fulfilment_weekdays.includes(weekdayOf(date))) {
    return false;
  }
  return true;
}

const SEARCH_DAYS = 366;

/**
 * First day the product can be handed over, counting its lead time from now
 * and skipping days outside its window/weekdays. Opening hours aren't known
 * here (they're per pickup/delivery); the DB checks them. null = never again
 * (season over, or no weekday fits).
 */
export function earliestDate(
  p: AvailabilityFields & Pick<Product, "lead_time_hours">,
  defaultLeadHours: number,
  timeZone: string,
  now: Date,
): string | null {
  const lead = p.lead_time_hours ?? defaultLeadHours;
  let date = localNow(timeZone, new Date(now.getTime() + lead * 3_600_000)).date;
  if (p.available_from && date < p.available_from) date = p.available_from;
  for (let i = 0; i < SEARCH_DAYS; i++) {
    if (p.available_until && date > p.available_until) return null;
    if (isAvailableOnDate(p, date)) return date;
    date = addDays(date, 1);
  }
  return null;
}

export type StockBadge =
  | { kind: "draft" }
  | { kind: "archived" }
  | { kind: "ended" }
  | { kind: "sold_out" }
  | { kind: "in_stock"; count: number }
  | { kind: "daily"; capacity: number }
  | { kind: "unlimited" };

/** What the product card says about availability (today = business-local date). */
export function stockBadge(
  p: Pick<Product, "status" | "stock_mode" | "stock_qty" | "daily_capacity" | "available_until">,
  today: string,
): StockBadge {
  if (p.status === "archived") return { kind: "archived" };
  if (p.status === "draft") return { kind: "draft" };
  if (p.available_until && p.available_until < today) return { kind: "ended" };
  if (p.stock_mode === "stock") {
    const count = p.stock_qty ?? 0;
    return count > 0 ? { kind: "in_stock", count } : { kind: "sold_out" };
  }
  if (p.stock_mode === "daily") {
    const capacity = p.daily_capacity ?? 0;
    return capacity > 0 ? { kind: "daily", capacity } : { kind: "sold_out" };
  }
  return { kind: "unlimited" };
}
