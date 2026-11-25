"use client";

import { cn } from "@/lib/utils";
import type { OrderStatus } from "../types";
import { useOrdersT, type OrdersT } from "./shared";

const TONE: Record<OrderStatus, string> = {
  pending: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  confirmed: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  preparing: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  ready: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  out_for_delivery: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
  rejected: "bg-muted text-muted-foreground line-through",
};

export function statusLabel(t: OrdersT, s: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    pending: t.osPending,
    confirmed: t.osConfirmed,
    preparing: t.osPreparing,
    ready: t.osReady,
    out_for_delivery: t.osOutForDelivery,
    completed: t.osCompleted,
    cancelled: t.osCancelled,
    rejected: t.osRejected,
  };
  return labels[s];
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useOrdersT();
  return <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", TONE[status])}>{statusLabel(t, status)}</span>;
}
