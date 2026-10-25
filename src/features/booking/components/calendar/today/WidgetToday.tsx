"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TodayBooking, TodayData } from "@/features/booking/dashboardTypes";
import { CustomerAvatar } from "../CustomerIdentity";
import { TodayRibbon } from "./TodayRibbon";
import { TodayFocusPanel } from "./TodayFocusPanel";
import { phaseOf, serviceLines, useTodayFormat, type TodayFormat } from "./todayFormat";

// The Today tab: how the business's day is going right now. A one-line status,
// a summary card (the day ribbon + four figures), the agenda with free time
// between appointments, and a focus panel on one appointment and its customer.
// A local clock ticks every 30s so countdowns, phases and the "now" needle
// stay live between data refreshes.

const TICK_MS = 30_000;

type AgendaItem =
  | { kind: "booking"; booking: TodayBooking }
  | { kind: "gap"; start: number; end: number };

export function WidgetToday({ data, loading }: { data: TodayData; loading: boolean }) {
  const { t } = useLanguage();
  const tt = t.bookingToday;
  const fmt = useTodayFormat(data.timezone, data.currencySymbol);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(h);
  }, []);

  const [pickedId, setPickedId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const agendaId = useId();

  const groups = useMemo(() => {
    const done: TodayBooking[] = [];
    const live: TodayBooking[] = [];
    const upcoming: TodayBooking[] = [];
    const cancelled: TodayBooking[] = [];
    for (const b of data.bookings) {
      const phase = phaseOf(b, now);
      (phase === "done" ? done : phase === "live" ? live : phase === "upcoming" ? upcoming : cancelled).push(b);
    }
    return { done, live, upcoming, cancelled };
  }, [data.bookings, now]);

  const confirmed = groups.done.length + groups.live.length + groups.upcoming.length;
  const totalCents = [...groups.done, ...groups.live, ...groups.upcoming].reduce((s, b) => s + (b.price_cents ?? 0), 0);
  const earnedCents = groups.done.reduce((s, b) => s + (b.price_cents ?? 0), 0);
  const occupancy = data.openMin > 0 ? Math.round((data.bookedMin / data.openMin) * 100) : null;

  // Free time from now on (gaps arrive for the whole day).
  const futureGaps = useMemo(
    () =>
      data.gaps
        .map((g) => ({ start: Math.max(Date.parse(g.start), now), end: Date.parse(g.end) }))
        .filter((g) => g.end - g.start >= 15 * 60_000),
    [data.gaps, now]
  );
  const freeMin = futureGaps.reduce((s, g) => s + (g.end - g.start) / 60_000, 0);

  // Focus: the owner's pick, else what's happening now, else what's next
  // (today, or the first appointment after today), else the day's last one.
  const defaultFocus = groups.live[0] ?? groups.upcoming[0] ?? null;
  const picked = pickedId
    ? data.bookings.find((b) => b.id === pickedId) ??
      (data.nextAfterToday?.id === pickedId ? data.nextAfterToday : null)
    : null;
  const focus = picked ?? defaultFocus ?? data.nextAfterToday ?? groups.done[groups.done.length - 1] ?? null;
  const focusIsLaterDay = focus !== null && focus.id === data.nextAfterToday?.id;
  const insight = focus?.customer_key ? data.insights[focus.customer_key] ?? null : null;

  function pick(id: string) {
    setPickedId(id);
    // Below lg the panel sits above the agenda — bring it into view.
    if (window.matchMedia?.("(max-width: 1023px)").matches) {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Status line: one sentence on where the day stands.
  const closed = data.hours.length === 0;
  const last = groups.upcoming[groups.upcoming.length - 1] ?? groups.live[groups.live.length - 1] ?? null;
  const remaining = groups.upcoming.length + groups.live.length;
  let status: string;
  if (confirmed === 0) status = closed ? tt.statusClosed : tt.statusEmpty;
  else if (remaining === 0) status = tt.statusDone.replace("{count}", String(confirmed));
  else if (remaining === 1) status = tt.statusRemainingOne.replace("{time}", fmt.time(last!.starts_at));
  else status = tt.statusRemaining.replace("{count}", String(remaining)).replace("{time}", fmt.time(last!.starts_at));
  const nextLine =
    remaining === 0 && data.nextAfterToday
      ? tt.nextAfter.replace("{when}", fmt.upcomingWhen(data.nextAfterToday.starts_at, now))
      : null;

  // Upcoming agenda, with free time slotted between appointments.
  const agenda = useMemo<AgendaItem[]>(() => {
    const items: AgendaItem[] = [
      ...groups.live.map((b) => ({ kind: "booking" as const, booking: b })),
      ...groups.upcoming.map((b) => ({ kind: "booking" as const, booking: b })),
      ...futureGaps.map((g) => ({ kind: "gap" as const, start: g.start, end: g.end })),
    ];
    const at = (i: AgendaItem) => (i.kind === "booking" ? Date.parse(i.booking.starts_at) : i.start);
    return items.sort((a, b) => at(a) - at(b));
  }, [groups.live, groups.upcoming, futureGaps]);

  const figures = [
    {
      label: tt.statAppointments,
      value: String(confirmed),
      hint: tt.statAppointmentsHint.replace("{done}", String(groups.done.length)),
    },
    {
      label: tt.statRevenue,
      value: fmt.money(totalCents),
      hint: tt.statRevenueHint.replace("{amount}", fmt.money(earnedCents)),
    },
    {
      label: tt.statOccupancy,
      value: occupancy === null ? "—" : `${occupancy}%`,
      hint:
        occupancy === null
          ? tt.closedToday
          : tt.statOccupancyHint.replace("{booked}", fmt.duration(data.bookedMin)).replace("{open}", fmt.duration(data.openMin)),
    },
    {
      label: tt.statFree,
      value: closed ? "—" : fmt.duration(freeMin),
      hint: tt.statFreeHint,
    },
  ];

  return (
    <div className={cn("space-y-6 transition-opacity", loading && "opacity-70")}>
      <header>
        <h2 className="text-2xl font-bold tracking-tight first-letter:uppercase">{fmt.longDate(now)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {status}
          {nextLine && <> {nextLine}</>}
        </p>
      </header>

      {/* Summary: the day ribbon + four figures */}
      <section className="rounded-2xl border border-border bg-background">
        {data.hours.length > 0 || data.blocks.length > 0 ? (
          <div className="p-5">
            <TodayRibbon data={data} now={now} selectedId={focus?.id ?? null} onSelect={pick} fmt={fmt} />
          </div>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">{tt.closedToday}</p>
        )}
        <dl className="grid grid-cols-2 border-t border-border sm:grid-cols-4">
          {figures.map((f, i) => (
            <div
              key={f.label}
              className={cn(
                "px-5 py-4",
                i % 2 === 1 && "border-l border-border",
                i >= 2 && "border-t border-border sm:border-t-0",
                i === 2 && "sm:border-l",
              )}
            >
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="mt-1 text-xl font-bold tracking-tight tabular-nums">{f.value}</dd>
              <dd className="mt-0.5 text-xs text-muted-foreground">{f.hint}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Focus panel — first on mobile, sticky on the right on desktop */}
        <div className="lg:order-2 lg:col-span-2">
          <div className="lg:sticky lg:top-6">
            <TodayFocusPanel
              ref={panelRef}
              booking={focus}
              isLaterDay={focusIsLaterDay}
              isPicked={picked !== null && picked !== defaultFocus}
              insight={insight}
              now={now}
              fmt={fmt}
            />
          </div>
        </div>

        {/* Agenda */}
        <section
          aria-labelledby={agendaId}
          className="rounded-2xl border border-border bg-background lg:order-1 lg:col-span-3"
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <h3 id={agendaId} className="font-semibold">
              {tt.agendaTitle}
            </h3>
            {groups.done.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {showDone ? tt.hideCompleted : tt.showCompleted.replace("{count}", String(groups.done.length))}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDone && "rotate-180")} />
              </button>
            )}
          </div>

          {confirmed === 0 && groups.cancelled.length === 0 ? (
            <p className="px-5 pb-6 pt-2 text-sm text-muted-foreground">
              {closed ? tt.statusClosed : tt.noBookingsAgenda}
            </p>
          ) : (
            <ol className="px-2 pb-2">
              {showDone &&
                groups.done.map((b) => (
                  <AgendaRow key={b.id} b={b} now={now} fmt={fmt} insight={insightBadge(data, b)} selected={focus?.id === b.id} onSelect={pick} />
                ))}
              {agenda.map((item) =>
                item.kind === "booking" ? (
                  <AgendaRow
                    key={item.booking.id}
                    b={item.booking}
                    now={now}
                    fmt={fmt}
                    insight={insightBadge(data, item.booking)}
                    selected={focus?.id === item.booking.id}
                    onSelect={pick}
                  />
                ) : (
                  <li key={`gap-${item.start}`} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">{fmt.time(item.start)}</span>
                    <span className="flex-1 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">
                      {tt.freeSlot
                        .replace("{duration}", fmt.duration((item.end - item.start) / 60_000))
                        .replace("{end}", fmt.time(item.end))}
                    </span>
                  </li>
                )
              )}
              {groups.live.length + groups.upcoming.length === 0 && !showDone && confirmed > 0 && (
                <li className="px-3 pb-3 pt-1 text-sm text-muted-foreground">{tt.statusDone.replace("{count}", String(confirmed))}</li>
              )}
            </ol>
          )}

          {groups.cancelled.length > 0 && (
            <div className="border-t border-border px-2 py-2">
              <button
                type="button"
                onClick={() => setShowCancelled((v) => !v)}
                aria-expanded={showCancelled}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {tt.cancelledToday.replace("{count}", String(groups.cancelled.length))}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showCancelled && "rotate-180")} />
              </button>
              {showCancelled && (
                <ol>
                  {groups.cancelled.map((b) => (
                    <AgendaRow key={b.id} b={b} now={now} fmt={fmt} insight={null} selected={focus?.id === b.id} onSelect={pick} />
                  ))}
                </ol>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// "New customer" / visit count for a row, from the day's insights.
function insightBadge(data: TodayData, b: TodayBooking): number | null {
  const c = b.customer_key ? data.insights[b.customer_key] : undefined;
  return c ? c.pastVisits + 1 : null;
}

function AgendaRow({
  b,
  now,
  fmt,
  insight: visitNumber,
  selected,
  onSelect,
}: {
  b: TodayBooking;
  now: number;
  fmt: TodayFormat;
  insight: number | null;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { t } = useLanguage();
  const tt = t.bookingToday;
  const phase = phaseOf(b, now);
  const start = Date.parse(b.starts_at);
  const end = Date.parse(b.ends_at);
  const lines = serviceLines(b);
  const staff = [...new Set(lines.map((l) => l.staff).filter(Boolean))].join(", ");

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(b.id)}
        aria-pressed={selected}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
          selected && "bg-emerald-500/10 hover:bg-emerald-500/15",
          (phase === "done" || phase === "cancelled") && "opacity-60",
        )}
      >
        <span className="w-12 shrink-0 tabular-nums">
          <span className={cn("block text-sm font-semibold", phase === "cancelled" && "line-through")}>{fmt.time(start)}</span>
          <span className="block text-xs text-muted-foreground">{fmt.time(end)}</span>
        </span>
        <CustomerAvatar name={b.customer_name} profile={b.customer_profile} className="hidden h-9 w-9 text-xs sm:flex" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{b.customer_name}</span>
            {visitNumber === 1 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                <Sparkles className="h-3 w-3" /> {tt.newCustomer}
              </span>
            )}
          </span>
          <span className="block truncate text-sm text-muted-foreground">
            {lines.map((l) => l.name).join(", ")}
            {staff && <> · {staff}</>}
          </span>
          {phase === "live" && (
            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-emerald-500/15">
              <span
                className="block h-full rounded-full bg-emerald-600"
                style={{ width: `${Math.min(100, ((now - start) / Math.max(1, end - start)) * 100)}%` }}
              />
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {phase === "live" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" />
              {t.booking.tagInProgress}
            </span>
          ) : phase === "upcoming" && start - now <= 4 * 60 * 60_000 ? (
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">{fmt.countdown(start, now)}</span>
          ) : phase === "cancelled" ? (
            <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300">{t.booking.tagCancelled}</span>
          ) : null}
          {b.price_cents != null && b.price_cents > 0 && phase !== "cancelled" && (
            <span className="text-sm tabular-nums text-muted-foreground">{fmt.money(b.price_cents)}</span>
          )}
        </span>
      </button>
    </li>
  );
}
