"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Self-contained month-grid date picker for the booking overlay. No date-picker
// dependency — the app already carries no such lib and the interaction is small
// and bespoke (availability-aware, emerald-themed, tz-agnostic civil dates).
//
// It deals purely in "YYYY-MM-DD" civil-date keys; the parent maps ISO slot
// instants → keys in the widget timezone and passes the set of bookable dates.
// Dates outside [minDate, maxDate] or without availability are shown dimmed and
// are focusable-but-not-selectable (the accessible date-grid pattern).

interface Props {
  availableDates: Set<string>; // "YYYY-MM-DD" keys with ≥1 open slot
  selected: string | null;
  onSelect: (dateKey: string) => void;
  minDate: string; // earliest bookable date (also treated as "today")
  maxDate: string; // latest bookable date in the window
  countFor?: (dateKey: string) => number; // open-slot count, for aria labels
}

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
// All arithmetic is anchored at noon UTC to stay clear of DST edges.
function addDaysKey(key: string, n: number): string {
  const { y, m, d } = parseKey(key);
  return new Date(Date.UTC(y, m, d + n, 12)).toISOString().slice(0, 10);
}
function daysInMonth(y: number, m0: number) {
  return new Date(Date.UTC(y, m0 + 1, 0, 12)).getUTCDate();
}
// Weekday of the 1st, Monday=0.
function firstWeekdayMon0(y: number, m0: number) {
  return (new Date(Date.UTC(y, m0, 1, 12)).getUTCDay() + 6) % 7;
}
function weekdayMon0(key: string) {
  const { y, m, d } = parseKey(key);
  return (new Date(Date.UTC(y, m, d, 12)).getUTCDay() + 6) % 7;
}
function clampKey(key: string, min: string, max: string) {
  return key < min ? min : key > max ? max : key;
}

const monthLabelFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});
const dayLabelFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
});
function labelForKey(key: string) {
  return dayLabelFmt.format(new Date(`${key}T12:00:00Z`));
}

// Calendar-shaped placeholder shown while availability loads — same footprint as
// MonthCalendar so the layout doesn't jump when the real grid arrives.
export function CalendarSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-background p-3" aria-hidden="true">
      <div className="mb-2 flex items-center justify-between">
        <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
        <div className="h-4 w-28 rounded bg-muted animate-pulse" />
        <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_HEADERS.map((w) => (
          <div key={w} className="text-center text-[11px] font-medium text-muted-foreground/40">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-11 w-full rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function MonthCalendar({
  availableDates,
  selected,
  onSelect,
  minDate,
  maxDate,
  countFor,
}: Props) {
  // Only the user's own focus movement is stored; until they move, focus (and so
  // the visible month) follows the controlled `selected` date. The visible month
  // is derived from the focused date — no state to keep in sync.
  const [userFocused, setUserFocused] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const focused = userFocused ?? selected ?? minDate;
  const view = parseKey(focused);

  const minMonth = parseKey(minDate);
  const maxMonth = parseKey(maxDate);
  const atMinMonth = view.y === minMonth.y && view.m === minMonth.m;
  const atMaxMonth = view.y === maxMonth.y && view.m === maxMonth.m;

  // Move DOM focus to the focused cell, but only once the grid already owns
  // focus — so we never steal it on mount.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !grid.contains(document.activeElement)) return;
    const el = grid.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`);
    el?.focus();
  }, [focused]);

  const cells = useMemo(() => {
    const lead = firstWeekdayMon0(view.y, view.m);
    const total = daysInMonth(view.y, view.m);
    const out: (string | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= total; d++) out.push(ymd(view.y, view.m, d));
    return out;
  }, [view.y, view.m]);

  function isSelectable(key: string) {
    return key >= minDate && key <= maxDate && availableDates.has(key);
  }

  function goMonth(delta: number) {
    const m = view.m + delta;
    const y = view.y + Math.floor(m / 12);
    const nm = ((m % 12) + 12) % 12;
    setUserFocused(clampKey(ymd(y, nm, 1), minDate, maxDate));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    let next: string | null = null;
    switch (e.key) {
      case "ArrowLeft":
        next = addDaysKey(focused, -1);
        break;
      case "ArrowRight":
        next = addDaysKey(focused, 1);
        break;
      case "ArrowUp":
        next = addDaysKey(focused, -7);
        break;
      case "ArrowDown":
        next = addDaysKey(focused, 7);
        break;
      case "Home":
        next = addDaysKey(focused, -weekdayMon0(focused));
        break;
      case "End":
        next = addDaysKey(focused, 6 - weekdayMon0(focused));
        break;
      case "PageUp":
        next = addDaysKey(focused, -28);
        break;
      case "PageDown":
        next = addDaysKey(focused, 28);
        break;
      case "Enter":
      case " ":
        if (isSelectable(focused)) onSelect(focused);
        e.preventDefault();
        return;
      default:
        return;
    }
    setUserFocused(clampKey(next, minDate, maxDate));
    e.preventDefault();
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => goMonth(-1)}
          disabled={atMinMonth}
          aria-label="Previous month"
          className="cursor-pointer inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span aria-live="polite" className="text-sm font-semibold">
          {monthLabelFmt.format(new Date(Date.UTC(view.y, view.m, 1, 12)))}
        </span>
        <button
          type="button"
          onClick={() => goMonth(1)}
          disabled={atMaxMonth}
          aria-label="Next month"
          className="cursor-pointer inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1" aria-hidden="true">
        {WEEKDAY_HEADERS.map((w) => (
          <div key={w} className="text-center text-[11px] font-medium text-muted-foreground">
            {w}
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label="Choose a date"
        onKeyDown={onKeyDown}
        className="grid grid-cols-7 gap-1"
      >
        {cells.map((key, i) => {
          if (!key) return <div key={`pad-${i}`} role="presentation" />;
          const selectable = isSelectable(key);
          const isSelected = key === selected;
          const isFocusTarget = key === focused;
          const isToday = key === minDate;
          const count = countFor?.(key) ?? 0;

          const label = selectable
            ? `${labelForKey(key)} — ${count} ${count === 1 ? "time" : "times"} available`
            : `${labelForKey(key)} — unavailable`;

          const base =
            "relative flex h-11 w-full items-center justify-center rounded-lg text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";
          const state = isSelected
            ? "bg-emerald-600 font-semibold text-white"
            : selectable
              ? "cursor-pointer font-medium text-foreground hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              : "cursor-default text-muted-foreground/40";
          const todayRing =
            isToday && !isSelected ? " ring-1 ring-inset ring-emerald-300 dark:ring-emerald-700" : "";

          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              data-date={key}
              tabIndex={isFocusTarget ? 0 : -1}
              aria-label={label}
              aria-selected={isSelected}
              aria-disabled={!selectable}
              onClick={() => selectable && onSelect(key)}
              onFocus={() => setUserFocused(key)}
              className={`${base} ${state}${todayRing}`}
            >
              {parseKey(key).d}
              {selectable && !isSelected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-emerald-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
