"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, Plus, Search, Settings, Store, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney } from "../domain/money";
import {
  ORDER_FILTERS,
  dayLabel,
  groupByDay,
  isHistoryFilter,
  itemsSummary,
  matchesFilter,
  matchesQuery,
  primaryStep,
  timeWindow,
  actionTarget,
  type OrderFilter,
  type OrderView,
  type StepAction,
} from "../domain/orders-view";
import { setOrderStatus } from "../actions/orders";
import type { OrdersData } from "../server/load-orders";
import type { ProductView } from "../server/load-products";
import type { OrderSettings } from "../types";
import { ManualOrderDialog } from "./ManualOrderDialog";
import { OrderSheet, actionLabel } from "./OrderSheet";
import { orderErrorText } from "./orderErrors";
import { StatusBadge } from "./StatusBadge";
import { EmptyState, FilterPill, fill, useOrdersT, type OrdersT } from "./shared";

// One list for any volume: search + status pills scope the orders, grouped by
// the day they're handed over (soonest first; history newest first). Details
// open in a dialog, so the list never grows sideways or nests.
export function OrdersTab({
  data,
  products,
  settings,
  currency,
  today,
  canCreate,
  defaultPhoneRegion,
  onOpenSettings,
}: {
  data: OrdersData;
  products: ProductView[];
  settings: OrderSettings | null;
  currency: string;
  today: string;
  canCreate: boolean;
  /** Dial-code country new phone numbers start with (from the business timezone). */
  defaultPhoneRegion: string;
  onOpenSettings: () => void;
}) {
  const { t, locale } = useOrdersT();
  const [filter, setFilter] = useState<OrderFilter>("active");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [todayOnly, setTodayOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const router = useRouter();
  const { orders } = data;

  // Feedback lines fade out on their own; a new one restarts the timer.
  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), flash.ok ? 4000 : 8000);
    return () => window.clearTimeout(id);
  }, [flash]);

  // One tap from the list for the usual next step (confirm, ready, picked up…).
  // Reject and cancel need a reason, so they stay in the order sheet.
  const quickStep = async (o: OrderView, a: StepAction) => {
    if (busyId) return;
    setBusyId(o.id);
    setFlash(null);
    const res = await setOrderStatus(o.id, actionTarget(a));
    setBusyId(null);
    if (!res.ok) setFlash({ ok: false, msg: `#${o.order_number}: ${orderErrorText(t, res.error, res.detail, products)}` });
    router.refresh();
  };

  const pick = (f: OrderFilter, onlyToday = false) => {
    setFilter(f);
    setTodayOnly(onlyToday);
  };

  const counts = useMemo(
    () => Object.fromEntries(ORDER_FILTERS.map((f) => [f, orders.filter((o) => matchesFilter(o, f)).length])) as Record<OrderFilter, number>,
    [orders],
  );
  const todayCount = useMemo(() => orders.filter((o) => o.fulfil_on === today && matchesFilter(o, "active")).length, [orders, today]);

  const groups = useMemo(() => {
    const visible = orders.filter(
      (o) => matchesFilter(o, filter) && matchesQuery(o, query) && (!todayOnly || o.fulfil_on === today),
    );
    return groupByDay(visible, isHistoryFilter(filter));
  }, [orders, filter, query, todayOnly, today]);
  const history = isHistoryFilter(filter);

  const open = openId ? orders.find((o) => o.id === openId) ?? null : null;
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }),
    [locale],
  );

  // `compact`: icon-only on phones, next to the search field.
  const newOrderButton = (compact = false) =>
    canCreate ? (
      <Button onClick={() => setCreating(true)} disabled={!settings} aria-label={compact ? t.newOrder : undefined} className={cn(compact && "max-sm:w-9 max-sm:px-0")}>
        <Plus className="h-4 w-4" /> <span className={cn(compact && "max-sm:sr-only")}>{t.newOrder}</span>
      </Button>
    ) : null;

  return (
    <div className="space-y-4">
      {!settings && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-amber-800/60 dark:bg-amber-950/30">
          <p className="text-amber-900 dark:text-amber-200">{t.oeNotSetUp}</p>
          <Button variant="outline" size="sm" onClick={onOpenSettings}>
            <Settings className="h-4 w-4" /> {t.openSettings}
          </Button>
        </div>
      )}
      {flash && (
        <p
          role={flash.ok ? "status" : "alert"}
          className={cn(
            "rounded-xl px-4 py-3 text-sm",
            flash.ok
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {flash.msg}
        </p>
      )}

      {/* One row of four, compact on phones so the list starts on the first screen. */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        <Stat label={t.statNew} value={counts.new} active={filter === "new" && !todayOnly} onClick={() => pick("new")} highlight={counts.new > 0} />
        <Stat label={t.statToPrepare} value={counts.to_prepare} active={filter === "to_prepare" && !todayOnly} onClick={() => pick("to_prepare")} />
        <Stat label={t.statReady} value={counts.ready} active={filter === "ready" && !todayOnly} onClick={() => pick("ready")} />
        <Stat label={t.statToday} value={todayCount} active={filter === "active" && todayOnly} onClick={() => pick("active", true)} />
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t.ordersEmptyTitle} body={t.ordersEmptyBody} action={newOrderButton()} />
      ) : (
        <>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchOrders}
                aria-label={t.searchOrders}
                className="h-9 pl-9"
              />
            </div>
            {newOrderButton(true)}
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
            {/* New / To prepare / Ready are the counters above; pills cover the rest. */}
            {PILL_FILTERS.map((f) => (
              <FilterPill key={f} active={filter === f} onClick={() => setFilter(f)} count={counts[f]}>
                {filterLabel(t, f)}
              </FilterPill>
            ))}
            {todayOnly && (
              <button
                type="button"
                onClick={() => setTodayOnly(false)}
                aria-label={t.showAllDays}
                title={t.showAllDays}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-orange-300 bg-orange-50 pl-3 pr-2 text-xs font-medium text-orange-800 outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-orange-100 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300"
              >
                {t.statToday} <X aria-hidden className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {groups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              {!query.trim() && filter === "active" && !todayOnly ? t.noOpenOrders : t.noOrdersMatch}
            </p>
          ) : (
            <div className="space-y-5">
              {groups.map((g) => {
                const label = dayLabel(g.day, today);
                // open orders whose day has passed still need closing (picked up? cancelled?)
                const overdue = !history && g.day < today;
                const title =
                  label.kind === "today"
                    ? t.today
                    : label.kind === "tomorrow"
                      ? t.tomorrow
                      : label.kind === "yesterday"
                        ? t.yesterday
                        : dateFmt.format(new Date(`${g.day}T00:00:00Z`));
                return (
                  <section key={g.day} aria-label={title}>
                    <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold capitalize">
                      {title}
                      <span className="text-xs font-normal text-muted-foreground tabular-nums">{g.orders.length}</span>
                      {overdue && (
                        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium normal-case text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          {t.overdue}
                        </span>
                      )}
                    </h3>
                    <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
                      {g.orders.map((o) => (
                        <OrderRow
                          key={o.id}
                          order={o}
                          onOpen={() => setOpenId(o.id)}
                          busy={busyId === o.id}
                          locked={busyId !== null}
                          onStep={(a) => quickStep(o, a)}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
          {data.truncated && <p className="text-center text-xs text-muted-foreground">{t.listTruncated}</p>}
        </>
      )}

      {open && (
        <OrderSheet
          key={open.id}
          order={open}
          products={products}
          pickupAddress={settings?.pickup_address ?? null}
          defaultPhoneRegion={defaultPhoneRegion}
          onClose={() => setOpenId(null)}
        />
      )}
      {creating && (
        <ManualOrderDialog
          products={products}
          currency={currency}
          today={today}
          pickupAddress={settings?.pickup_address ?? null}
          defaultPhoneRegion={defaultPhoneRegion}
          onClose={() => setCreating(false)}
          onCreated={(n, id) => {
            setCreating(false);
            setFlash({ ok: true, msg: fill(t.orderCreated, { n }) });
            // straight into the new order (it shows once the refreshed list arrives)
            setOpenId(id);
          }}
        />
      )}
    </div>
  );
}

const PILL_FILTERS: OrderFilter[] = ["active", "done", "cancelled"];

function filterLabel(t: OrdersT, f: OrderFilter): string {
  const labels: Record<OrderFilter, string> = {
    active: t.filterActive,
    new: t.statNew,
    to_prepare: t.statToPrepare,
    ready: t.statReady,
    done: t.filterDone,
    cancelled: t.filterCancelled,
  };
  return labels[f];
}

function Stat({
  label,
  value,
  onClick,
  highlight,
  active,
}: {
  label: string;
  value: number;
  onClick: () => void;
  highlight?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-w-0 rounded-xl border px-2 py-1.5 text-left outline-none sm:px-3 sm:py-2.5 transition-[background-color,border-color,transform] duration-150 ease-out hover:bg-muted/40 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring/50",
        highlight ? "border-orange-300 bg-orange-50/60 dark:border-orange-800 dark:bg-orange-950/20" : "border-border/60 bg-card",
        active && "ring-1 ring-foreground/70",
      )}
    >
      <span className="block truncate text-[11px] text-muted-foreground sm:text-xs">{label}</span>
      <span className="block text-lg font-semibold tabular-nums sm:text-xl">{value}</span>
    </button>
  );
}

function OrderRow({
  order: o,
  onOpen,
  onStep,
  busy,
  locked,
}: {
  order: OrderView;
  onOpen: () => void;
  onStep: (a: StepAction) => void;
  busy: boolean;
  locked: boolean;
}) {
  const { t, locale } = useOrdersT();
  const time = timeWindow(o.fulfil_from, o.fulfil_to);
  const summary = itemsSummary(o.items);
  const Method = o.fulfilment_method === "delivery" ? Truck : Store;
  const next = primaryStep(o.status, o.fulfilment_method);
  return (
    <li className="flex items-center transition-colors duration-150 hover:bg-muted/50">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left outline-none focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
      >
        <span className="w-[4.75rem] shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">{time ?? t.anyTime}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <span className="text-muted-foreground tabular-nums">#{o.order_number}</span>
            <span className="truncate">{o.customer_name}</span>
            <Method aria-label={o.fulfilment_method === "delivery" ? t.delivery : t.pickup} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {summary.text}
            {summary.more > 0 ? ` ${fill(t.moreItems, { n: summary.more })}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm tabular-nums">{formatMoney(o.total_cents, o.currency, locale)}</span>
          <span className="flex items-center gap-1">
            {o.payment_status === "paid" && <span className="text-[11px] text-emerald-700 dark:text-emerald-400">{t.paid}</span>}
            <StatusBadge status={o.status} />
          </span>
        </span>
      </button>
      {next && (
        <div className="shrink-0 pr-3">
          <Button
            size="sm"
            variant={o.status === "pending" ? "default" : "outline"}
            disabled={locked}
            onClick={() => onStep(next)}
            aria-label={`${actionLabel(t, next)} #${o.order_number}`}
            className="h-8 min-w-20 px-2.5 text-xs"
          >
            {busy ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : actionLabel(t, next)}
          </Button>
        </div>
      )}
    </li>
  );
}
