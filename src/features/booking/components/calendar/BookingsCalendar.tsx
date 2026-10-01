"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { BookingRow, type BookingRowData } from "./BookingRow";
import { useLanguage } from "@/contexts/LanguageContext";

// Google-Calendar-style month grid that plots bookings as event chips on the day
// they start (civil date in the widget timezone). Selecting a day reveals that
// day's bookings below the grid as full BookingRows, so the reschedule/cancel
// actions stay available — the grid is a navigator, the agenda does the work.
//
// It reuses the list view's already-filtered `bookings`, so search and the
// status pills apply here too. All date math is anchored at noon UTC to dodge
// DST edges, mirroring MonthCalendar.

interface Props {
  bookings: BookingRowData[]; // the viewed month's rows, filtered by search + status
  // The viewed month ("YYYY-MM"), controlled by the parent so changing it can
  // refetch that month's rows server-side. `onMonthChange` fires on prev/next/today.
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
}

// 2024-01-01 was a Monday (UTC) — a stable anchor for deriving locale-aware
// short weekday names (Mon..Sun) via Intl instead of hardcoding English.
function weekdayHeaders(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))));
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(y: number, m0: number, d: number) {
  return `${y}-${pad(m0 + 1)}-${pad(d)}`;
}
function parseKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m: m - 1, d };
}
function daysInMonth(y: number, m0: number) {
  return new Date(Date.UTC(y, m0 + 1, 0, 12)).getUTCDate();
}
// Weekday of the 1st, Monday=0.
function firstWeekdayMon0(y: number, m0: number) {
  return (new Date(Date.UTC(y, m0, 1, 12)).getUTCDay() + 6) % 7;
}

function monthLabelFmt(locale: string) {
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "long", year: "numeric" });
}
function dayLabelFmt(locale: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
function labelForKey(locale: string, key: string) {
  return dayLabelFmt(locale).format(new Date(`${key}T12:00:00Z`));
}

export function BookingsCalendar({ bookings, monthKey, onMonthChange, timezone, now, money, fmtDate, onNewBooking, hasStaff = false }: Props) {
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

  // The viewed month is controlled by the parent (drives the month refetch), so
  // it's derived from `monthKey` rather than held as local state.
  const view = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return { y, m: m - 1 };
  }, [monthKey]);
  const [selected, setSelected] = useState<string>(todayKey);
  const [modalDay, setModalDay] = useState<string | null>(null);

  // Group bookings by their start day-key, each day sorted earliest-first.
  const byDay = useMemo(() => {
    const map = new Map<string, BookingRowData[]>();
    for (const b of bookings) {
      const key = dayKeyFmt.format(new Date(b.starts_at));
      const list = map.get(key);
      if (list) list.push(b);
      else map.set(key, [b]);
    }
    for (const list of map.values())
      list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    return map;
  }, [bookings, dayKeyFmt]);

  const cells = useMemo(() => {
    const lead = firstWeekdayMon0(view.y, view.m);
    const total = daysInMonth(view.y, view.m);
    const out: (string | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= total; d++) out.push(ymd(view.y, view.m, d));
    return out;
  }, [view.y, view.m]);

  function goMonth(delta: number) {
    const mm = view.m + delta;
    const y = view.y + Math.floor(mm / 12);
    const m0 = ((mm % 12) + 12) % 12;
    onMonthChange(`${y}-${pad(m0 + 1)}`);
  }
  function goToday() {
    const tk = parseKey(todayKey);
    onMonthChange(`${tk.y}-${pad(tk.m + 1)}`);
    setSelected(todayKey);
  }

  const selectedList = byDay.get(selected) ?? [];

  function chipClass(b: BookingRowData) {
    if (b.status === "cancelled")
      return "bg-muted text-muted-foreground line-through";
    if (new Date(b.starts_at).getTime() >= now)
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    return "bg-muted text-muted-foreground";
  }

  // Shared BookingRow list — used by both the selected-day agenda and the
  // per-day modal so their rows behave identically (reschedule/cancel, dimming).
  function renderRows(list: BookingRowData[]) {
    return (
      <div className="divide-y divide-border">
        {list.map((b) => {
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
            />
          );
        })}
      </div>
    );
  }

  const modalList = modalDay ? (byDay.get(modalDay) ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        {/* Month toolbar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              aria-label={t.booking.previousMonthAria}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => goMonth(1)}
              aria-label={t.booking.nextMonthAria}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span aria-live="polite" className="ml-1 text-sm font-semibold">
              {monthLabelFmt(locale).format(new Date(Date.UTC(view.y, view.m, 1, 12)))}
            </span>
          </div>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-border px-2.5 py-1 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {t.booking.today}
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {headers.map((w, i) => (
            <div
              key={i}
              className="px-2 py-1.5 text-center text-[11px] font-medium text-muted-foreground"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {cells.map((key, i) => {
            if (!key)
              return (
                <div
                  key={`pad-${i}`}
                  className="min-h-[92px] border-b border-r border-border bg-muted/20 last:border-r-0"
                />
              );
            const events = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            const isSelected = key === selected;
            const col = (firstWeekdayMon0(view.y, view.m) + parseKey(key).d - 1) % 7;

            const openDay = () => {
              setSelected(key);
              if (events.length) setModalDay(key);
            };

            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={openDay}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDay();
                  }
                }}
                aria-label={`${labelForKey(locale, key)} — ${events.length} ${
                  events.length === 1 ? t.booking.bookingCountSingular : t.booking.bookingCountPlural
                }`}
                aria-pressed={isSelected}
                className={`min-h-[92px] cursor-pointer border-b border-border p-1.5 text-left align-top transition last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 ${
                  col === 6 ? "" : "border-r"
                } ${isSelected ? "bg-emerald-50/60 dark:bg-emerald-950/20" : "hover:bg-muted/40"}`}
              >
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
                <div className="mt-1 space-y-0.5">
                  {events.slice(0, 3).map((b) => (
                    <div
                      key={b.id}
                      className={`truncate rounded px-1 py-0.5 text-[11px] leading-tight ${chipClass(b)}`}
                      title={`${timeFmt.format(new Date(b.starts_at))} · ${b.customer_name}`}
                    >
                      <span className="tabular-nums">{timeFmt.format(new Date(b.starts_at))}</span>{" "}
                      {b.customer_name}
                    </div>
                  ))}
                  {events.length > 3 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalDay(key);
                      }}
                      className="rounded px-1 text-[11px] font-medium text-emerald-600 transition hover:bg-emerald-50 hover:underline dark:hover:bg-emerald-950/30"
                    >
                      +{events.length - 3}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected-day agenda */}
      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold">{labelForKey(locale, selected)}</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">
              {selectedList.length}{" "}
              {selectedList.length === 1 ? t.booking.bookingCountSingular : t.booking.bookingCountPlural}
            </span>
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
            {onNewBooking && (
              <button
                type="button"
                onClick={() => onNewBooking(selected)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" /> {t.booking.manualAddOnDay}
              </button>
            )}
          </div>
        ) : (
          renderRows(selectedList)
        )}
      </div>

      {/* Full-day modal — opened from a day cell or its "+N" chip */}
      <Dialog
        open={modalDay !== null}
        onClose={() => setModalDay(null)}
        title={modalDay ? labelForKey(locale, modalDay) : undefined}
      >
        <p className="mb-3 text-xs text-muted-foreground">
          {modalList.length}{" "}
          {modalList.length === 1 ? t.booking.bookingCountSingular : t.booking.bookingCountPlural}
        </p>
        <div className="-mx-2 max-h-[60vh] overflow-y-auto">
          {modalList.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {t.booking.noBookingsOnDay}
            </p>
          ) : (
            renderRows(modalList)
          )}
        </div>
      </Dialog>
    </div>
  );
}
