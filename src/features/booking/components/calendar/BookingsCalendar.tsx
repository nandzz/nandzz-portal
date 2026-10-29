"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react";
import { BookingRow, type BookingRowData } from "./BookingRow";
import { useLanguage } from "@/contexts/LanguageContext";

// The Bookings tab's overview calendar — a navigator for past, present and
// future rather than a "today" view (the Today tab owns that). A month or week
// grid plots bookings on the day they start (civil date in the widget
// timezone), tints each day by how busy it is, and a stats strip summarises the
// visible period. Selecting a day reveals its bookings below as full
// BookingRows, so reschedule/cancel stay available — the grid navigates, the
// agenda does the work.
//
// The server returns the month's whole Monday-first grid, so the week view can
// show any week of it without refetching. All date math is anchored at noon UTC
// to dodge DST edges, mirroring MonthCalendar.

interface Props {
  bookings: BookingRowData[]; // the grid's rows, filtered by search + status (plotted)
  allBookings: BookingRowData[]; // the grid's rows, unfiltered (period stats)
  // The viewed month ("YYYY-MM"), controlled by the parent so changing it can
  // refetch that month's grid server-side.
  monthKey: string;
  onMonthChange: (monthKey: string) => void;
  timezone: string;
  now: number; // server request time (ms)
  money: (cents: number) => string;
  fmtDate: (iso: string) => string; // full date+time formatter for agenda rows
  // Opens the owner's manual-booking flow, seeded with the given day
  // ("YYYY-MM-DD") — the day the owner clicked "Add booking" on.
  onNewBooking?: (dateKey: string) => void;
  // Whether the instance has staff — gates the per-service "Assign staff" action
  // on each agenda row (same as the list view).
  hasStaff?: boolean;
  // Refetch after a row's reschedule/reassign/cancel.
  onChanged?: () => void;
}

type Mode = "month" | "week";

// 2024-01-01 was a Monday (UTC) — a stable anchor for deriving locale-aware
// short weekday names (Mon..Sun) via Intl instead of hardcoding English.
function weekdayHeaders(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))));
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function parseKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m: m - 1, d };
}
function addDaysKey(key: string, n: number): string {
  const { y, m, d } = parseKey(key);
  return new Date(Date.UTC(y, m, d + n, 12)).toISOString().slice(0, 10);
}
// Weekday, Monday=0.
function weekdayMon0(key: string) {
  const { y, m, d } = parseKey(key);
  return (new Date(Date.UTC(y, m, d, 12)).getUTCDay() + 6) % 7;
}
function mondayOf(key: string) {
  return addDaysKey(key, -weekdayMon0(key));
}
function monthOfKey(key: string) {
  return key.slice(0, 7);
}
// Every day of the month's Monday-first grid (full weeks) — the same window the
// server fetches for `monthKey`.
function gridDays(y: number, m0: number): string[] {
  const first = `${y}-${pad(m0 + 1)}-01`;
  const last = new Date(Date.UTC(y, m0 + 1, 0, 12)).toISOString().slice(0, 10);
  const out: string[] = [];
  for (let k = mondayOf(first); k <= addDaysKey(mondayOf(last), 6); k = addDaysKey(k, 1)) out.push(k);
  return out;
}

// Rows grouped by their start day-key in the widget timezone, earliest first.
function groupByDay(list: BookingRowData[], dayKeyFmt: Intl.DateTimeFormat) {
  const map = new Map<string, BookingRowData[]>();
  for (const b of list) {
    const key = dayKeyFmt.format(new Date(b.starts_at));
    const arr = map.get(key);
    if (arr) arr.push(b);
    else map.set(key, [b]);
  }
  for (const arr of map.values())
    arr.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return map;
}

function keyDate(key: string) {
  return new Date(`${key}T12:00:00Z`);
}
function labelForKey(locale: string, key: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(keyDate(key));
}

// Background tint for a day by its booking count relative to the busiest day in
// view — a heat scale so busy and quiet days read at a glance.
const HEAT = [
  "",
  "bg-emerald-500/[0.06]",
  "bg-emerald-500/[0.12]",
  "bg-emerald-500/[0.2]",
  "bg-emerald-500/[0.3]",
];
function heatClass(count: number, max: number) {
  if (!count || !max) return "";
  return HEAT[Math.max(1, Math.ceil((count / max) * 4))];
}

export function BookingsCalendar({
  bookings,
  allBookings,
  monthKey,
  onMonthChange,
  timezone,
  now,
  money,
  fmtDate,
  onNewBooking,
  hasStaff = false,
  onChanged,
}: Props) {
  const { t, locale } = useLanguage();
  const headers = useMemo(() => weekdayHeaders(locale), [locale]);
  // Civil date-key ("YYYY-MM-DD") for an instant in the widget timezone. Always
  // en-CA regardless of visitor locale — this is a lookup key, not display text.
  const dayKeyFmt = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    [timezone]
  );
  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { timeZone: timezone, hour: "numeric", minute: "2-digit" }),
    [timezone, locale]
  );

  const todayKey = dayKeyFmt.format(new Date(now));

  // The viewed month is controlled by the parent (drives the grid refetch), so
  // it's derived from `monthKey` rather than held as local state.
  const view = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return { y, m: m - 1 };
  }, [monthKey]);
  const [mode, setMode] = useState<Mode>("month");
  const [selected, setSelected] = useState<string>(todayKey);
  const agendaRef = useRef<HTMLDivElement>(null);

  const grid = useMemo(() => gridDays(view.y, view.m), [view.y, view.m]);
  const weekStart = mondayOf(selected);
  const days = useMemo(
    () => (mode === "month" ? grid : Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i))),
    [mode, grid, weekStart]
  );

  const byDay = useMemo(() => groupByDay(bookings, dayKeyFmt), [bookings, dayKeyFmt]);
  const allByDay = useMemo(() => groupByDay(allBookings, dayKeyFmt), [allBookings, dayKeyFmt]);

  // Heat counts ignore cancellations unless that's all a day holds (i.e. the
  // "cancelled" status filter is on), so a busy day means real appointments.
  const heatCount = (key: string) => {
    const ev = byDay.get(key) ?? [];
    const live = ev.filter((b) => b.status !== "cancelled").length;
    return live || ev.length;
  };
  const maxHeat = Math.max(0, ...days.map(heatCount));

  // Period stats: the visible month (its own days, not the grid padding) or
  // week, over every booking regardless of search/status.
  const stats = useMemo(() => {
    const periodDays =
      mode === "month" ? grid.filter((k) => monthOfKey(k) === monthKey) : days;
    let confirmed = 0;
    let cancelled = 0;
    let revenueCents = 0;
    const customers = new Set<string>();
    let busiest: { key: string; count: number } | null = null;
    for (const key of periodDays) {
      let dayCount = 0;
      for (const b of allByDay.get(key) ?? []) {
        if (b.status === "cancelled") {
          cancelled += 1;
          continue;
        }
        confirmed += 1;
        dayCount += 1;
        revenueCents += b.price_cents ?? 0;
        customers.add((b.customer_email || b.customer_name).trim().toLowerCase());
      }
      if (dayCount && (!busiest || dayCount > busiest.count)) busiest = { key, count: dayCount };
    }
    const total = confirmed + cancelled;
    return {
      confirmed,
      cancelled,
      revenueCents,
      customers: customers.size,
      avgCents: confirmed ? Math.round(revenueCents / confirmed) : 0,
      cancelPct: total ? Math.round((cancelled / total) * 100) : 0,
      busiest,
    };
  }, [mode, grid, days, monthKey, allByDay]);

  // Moves the selection, refetching the month when the target falls outside the
  // loaded grid. A week is always inside the grid of its Thursday's month (the
  // ISO-week rule), so that's the month to load for week navigation.
  function selectDay(key: string, opts: { scroll?: boolean } = {}) {
    setSelected(key);
    if (!grid.includes(key)) onMonthChange(monthOfKey(addDaysKey(mondayOf(key), 3)));
    if (opts.scroll && window.matchMedia("(max-width: 1023px)").matches)
      agendaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goMonthKey(key: string) {
    onMonthChange(key);
    setSelected(monthOfKey(todayKey) === key ? todayKey : `${key}-01`);
  }
  function step(delta: number) {
    if (mode === "week") {
      const next = addDaysKey(selected, delta * 7);
      const week = Array.from({ length: 7 }, (_, i) => addDaysKey(mondayOf(next), i));
      setSelected(next);
      if (!week.every((k) => grid.includes(k))) onMonthChange(monthOfKey(addDaysKey(mondayOf(next), 3)));
      return;
    }
    const mm = view.m + delta;
    const y = view.y + Math.floor(mm / 12);
    const m0 = ((mm % 12) + 12) % 12;
    goMonthKey(`${y}-${pad(m0 + 1)}`);
  }
  function goToday() {
    setSelected(todayKey);
    if (!grid.includes(todayKey) || monthOfKey(todayKey) !== monthKey) onMonthChange(monthOfKey(todayKey));
  }

  // Previous / next day with bookings, within the loaded grid.
  const busyKeys = useMemo(() => [...byDay.keys()].filter((k) => grid.includes(k)).sort(), [byDay, grid]);
  const prevBusy = [...busyKeys].reverse().find((k) => k < selected) ?? null;
  const nextBusy = busyKeys.find((k) => k > selected) ?? null;

  const selectedList = byDay.get(selected) ?? [];

  function chipClass(b: BookingRowData) {
    if (b.status === "cancelled") return "bg-muted text-muted-foreground line-through";
    if (new Date(b.starts_at).getTime() >= now)
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    return "bg-muted text-muted-foreground";
  }

  const periodLabel =
    mode === "month"
      ? new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "long", year: "numeric" }).format(
          new Date(Date.UTC(view.y, view.m, 1, 12))
        )
      : new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).formatRange(
          keyDate(weekStart),
          keyDate(addDaysKey(weekStart, 6))
        );

  const countLabel = (n: number) =>
    `${n} ${n === 1 ? t.booking.bookingCountSingular : t.booking.bookingCountPlural}`;

  const navBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        {/* Navigation: prev/next, month picker, month/week, today */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={mode === "month" ? t.booking.previousMonthAria : t.booking.previousWeekAria}
              className={navBtn}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={mode === "month" ? t.booking.nextMonthAria : t.booking.nextWeekAria}
              className={navBtn}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <MonthPicker
              label={periodLabel}
              monthKey={monthKey}
              todayKey={todayKey}
              onPick={(key) => goMonthKey(key)}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5 text-sm">
              {(["month", "week"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`rounded-md px-2.5 py-1 font-medium transition ${
                    mode === m ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "month" ? t.booking.viewMonth : t.booking.viewWeek}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={goToday}
              className="rounded-lg border border-border px-2.5 py-1 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {t.booking.today}
            </button>
          </div>
        </div>

        {/* Period stats — the visible month/week, independent of search + status */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-border px-4 py-3 sm:grid-cols-4">
          <Stat
            label={t.booking.periodBookings}
            value={String(stats.confirmed)}
            hint={t.booking.periodCustomers.replace("{count}", String(stats.customers))}
          />
          <Stat
            label={t.booking.revenue}
            value={money(stats.revenueCents)}
            hint={stats.confirmed ? t.booking.periodAvg.replace("{amount}", money(stats.avgCents)) : "—"}
          />
          <Stat
            label={t.booking.filterCancelled}
            value={String(stats.cancelled)}
            hint={t.booking.periodCancelRate.replace("{pct}", String(stats.cancelPct))}
          />
          {stats.busiest ? (
            <button
              type="button"
              onClick={() => selectDay(stats.busiest!.key, { scroll: true })}
              className="-m-1.5 rounded-lg p-1.5 text-left transition hover:bg-muted/60"
            >
              <Stat
                label={t.booking.busiestDay}
                value={new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", day: "numeric" }).format(
                  keyDate(stats.busiest.key)
                )}
                hint={countLabel(stats.busiest.count)}
              />
            </button>
          ) : (
            <Stat label={t.booking.busiestDay} value="—" hint="" />
          )}
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {headers.map((w, i) => (
            <div key={i} className="px-2 py-1.5 text-center text-[11px] font-medium text-muted-foreground">
              {w}
            </div>
          ))}
        </div>

        {/* Day grid (month) or day columns (week) */}
        <div className="grid grid-cols-7">
          {days.map((key, i) => {
            const events = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            const isSelected = key === selected;
            const outside = mode === "month" && monthOfKey(key) !== monthKey;
            const limit = mode === "month" ? 3 : events.length;
            const heat = heatCount(key);

            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => selectDay(key, { scroll: true })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectDay(key, { scroll: true });
                  }
                }}
                aria-label={`${labelForKey(locale, key)}, ${countLabel(events.length)}`}
                aria-pressed={isSelected}
                className={`relative cursor-pointer border-b border-border p-1.5 text-left align-top transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 ${
                  mode === "month" ? "min-h-[64px] sm:min-h-[92px]" : "min-h-[120px] sm:min-h-[280px]"
                } ${i % 7 === 6 ? "" : "border-r"} ${heatClass(heat, maxHeat)} ${
                  isSelected ? "ring-2 ring-inset ring-emerald-500" : "hover:bg-muted/40"
                } ${outside ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      isToday
                        ? "bg-emerald-600 text-white"
                        : isSelected
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-foreground"
                    }`}
                  >
                    {parseKey(key).d}
                  </span>
                  {events.length > 0 && (
                    <span className="rounded-full bg-emerald-600/15 px-1.5 text-[10px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {events.length}
                    </span>
                  )}
                </div>
                <div className="mt-1 hidden space-y-0.5 sm:block">
                  {events.slice(0, limit).map((b) => (
                    <div
                      key={b.id}
                      className={`truncate rounded px-1 py-0.5 text-[11px] leading-tight ${chipClass(b)}`}
                      title={`${timeFmt.format(new Date(b.starts_at))} · ${b.customer_name} · ${b.service_name}`}
                    >
                      <span className="tabular-nums">{timeFmt.format(new Date(b.starts_at))}</span> {b.customer_name}
                      {mode === "week" && <span className="block truncate opacity-70">{b.service_name}</span>}
                    </div>
                  ))}
                  {events.length > limit && (
                    <span className="block px-1 text-[11px] font-medium text-emerald-600">
                      +{events.length - limit}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected-day agenda */}
      <div ref={agendaRef} className="scroll-mt-4 overflow-hidden rounded-2xl border border-border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => prevBusy && selectDay(prevBusy)}
              disabled={!prevBusy}
              aria-label={t.booking.prevBusyDayAria}
              title={t.booking.prevBusyDayAria}
              className={navBtn}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="truncate text-sm font-semibold first-letter:uppercase">{labelForKey(locale, selected)}</h3>
            <button
              type="button"
              onClick={() => nextBusy && selectDay(nextBusy)}
              disabled={!nextBusy}
              aria-label={t.booking.nextBusyDayAria}
              title={t.booking.nextBusyDayAria}
              className={navBtn}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">{countLabel(selectedList.length)}</span>
            {onNewBooking && (
              <button
                type="button"
                onClick={() => onNewBooking(selected)}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"
              >
                <Plus className="h-3.5 w-3.5" /> {t.booking.manualAddOnDay}
              </button>
            )}
          </div>
        </div>
        {selectedList.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <CalendarDays className="mx-auto h-7 w-7 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">{t.booking.noBookingsOnDay}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {selectedList.map((b) => {
              const upcoming = b.status === "confirmed" && new Date(b.starts_at).getTime() >= now;
              return (
                <BookingRow
                  key={b.id}
                  b={b}
                  money={money}
                  fmt={fmtDate}
                  timezone={timezone}
                  now={now}
                  cancellable={upcoming}
                  dim={!upcoming}
                  hasStaff={hasStaff}
                  onChanged={onChanged}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-lg font-bold tabular-nums first-letter:uppercase">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground">{hint || " "}</p>
    </div>
  );
}

// Month/year jump: the period label opens a small year + 12-month grid so the
// owner can reach any month in two clicks instead of paging with the arrows.
function MonthPicker({
  label,
  monthKey,
  todayKey,
  onPick,
}: {
  label: string;
  monthKey: string;
  todayKey: string;
  onPick: (monthKey: string) => void;
}) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(monthKey.slice(0, 4)));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const monthFmt = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "short" }), [locale]);
  const todayMonth = todayKey.slice(0, 7);

  return (
    <div ref={ref} className="relative ml-1">
      <button
        type="button"
        onClick={() => {
          setYear(Number(monthKey.slice(0, 4)));
          setOpen((o) => !o);
        }}
        aria-label={t.booking.pickMonthAria}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold transition first-letter:uppercase hover:bg-muted"
      >
        <span aria-live="polite">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-border bg-background p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              aria-label={t.booking.previousYearAria}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold tabular-nums">{year}</span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              aria-label={t.booking.nextYearAria}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 12 }, (_, i) => {
              const key = `${year}-${pad(i + 1)}`;
              const active = key === monthKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onPick(key);
                    setOpen(false);
                  }}
                  className={`rounded-lg px-2 py-1.5 text-sm capitalize transition ${
                    active
                      ? "bg-emerald-600 font-semibold text-white"
                      : key === todayMonth
                        ? "font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-300 hover:bg-muted dark:text-emerald-300 dark:ring-emerald-800"
                        : "hover:bg-muted"
                  }`}
                >
                  {monthFmt.format(new Date(Date.UTC(year, i, 1, 12)))}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
