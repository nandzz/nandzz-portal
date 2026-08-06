"use client";

import { useMemo, useState } from "react";
import {
  Search,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  LayoutGrid,
  Clock,
  Wallet,
} from "lucide-react";
import { BookingRow, type BookingRowData } from "./BookingRow";
import { BookingsCalendar } from "./BookingsCalendar";
import { useLanguage } from "@/contexts/LanguageContext";

export type WidgetBookingsData = {
  timezone: string;
  currencySymbol: string;
  now: number; // server request time (ms) — anchors upcoming/past filtering
  bookings: BookingRowData[]; // all bookings, newest first
};

const PAGE_SIZE = 12;

type Filter = "all" | "upcoming" | "past" | "cancelled";
type View = "list" | "calendar";

export function WidgetBookings({ data }: { data: WidgetBookingsData }) {
  const { t, locale } = useLanguage();
  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: t.booking.filterAll },
    { key: "upcoming", label: t.booking.filterUpcoming },
    { key: "past", label: t.booking.filterPast },
    { key: "cancelled", label: t.booking.filterCancelled },
  ];
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [view, setView] = useState<View>("list");

  const now = data.now;

  const money = (cents: number) =>
    `${data.currencySymbol}${(cents / 100).toLocaleString(undefined, {
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;

  const fmtDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: data.timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [data.timezone, locale]
  );

  const fmtTime = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: data.timezone,
        hour: "numeric",
        minute: "2-digit",
      }),
    [data.timezone, locale]
  );

  // "Today Overview" — a same-day snapshot anchored to the widget timezone,
  // independent of the search box and status pills below it. dayFmt stays
  // en-CA regardless of visitor locale — it's a lookup key, not display text.
  const today = useMemo(() => {
    const dayFmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: data.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const longFmt = new Intl.DateTimeFormat(locale, {
      timeZone: data.timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const todayKey = dayFmt.format(new Date(now));
    const confirmedToday = data.bookings
      .filter(
        (b) => b.status === "confirmed" && dayFmt.format(new Date(b.starts_at)) === todayKey
      )
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    const next = confirmedToday.find((b) => new Date(b.starts_at).getTime() >= now) ?? null;
    const done = confirmedToday.filter((b) => new Date(b.starts_at).getTime() < now).length;
    const revenueCents = confirmedToday.reduce((sum, b) => sum + (b.price_cents ?? 0), 0);
    return {
      label: longFmt.format(new Date(now)),
      count: confirmedToday.length,
      done,
      next,
      revenueCents,
    };
  }, [data.bookings, data.timezone, now, locale]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.bookings.filter((b) => {
      if (filter !== "all") {
        const t = new Date(b.starts_at).getTime();
        const cancelled = b.status === "cancelled";
        if (filter === "cancelled" && !cancelled) return false;
        if (filter === "upcoming" && (cancelled || t < now)) return false;
        if (filter === "past" && (cancelled || t >= now)) return false;
      }
      if (!q) return true;
      return (
        b.customer_name.toLowerCase().includes(q) ||
        b.customer_email.toLowerCase().includes(q) ||
        b.service_name.toLowerCase().includes(q)
      );
    });
  }, [data.bookings, query, filter, now]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const start = current * PAGE_SIZE;
  const shown = filtered.slice(start, start + PAGE_SIZE);

  function reset(fn: () => void) {
    fn();
    setPage(0);
  }

  if (data.bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background px-5 py-12 text-center">
        <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium">{t.booking.noBookingsYetTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t.booking.noBookingsYetDesc}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Today Overview — same-day snapshot, above the search/filter toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">{t.booking.today}</p>
          <p className="text-sm font-semibold">{today.label}</p>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:gap-6">
          <div>
            <p className="text-xs text-muted-foreground">{t.booking.appointments}</p>
            <p className="text-lg font-bold tabular-nums">{today.count}</p>
            <p className="text-[11px] text-muted-foreground">
              {t.booking.doneCount.replace("{count}", String(today.done))}
            </p>
          </div>
          <div>
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {t.booking.nextUp}
            </p>
            <p className="text-lg font-bold tabular-nums">
              {today.next ? fmtTime.format(new Date(today.next.starts_at)) : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {today.next
                ? t.booking.stillToCome
                : today.count
                  ? t.booking.allDone
                  : t.booking.nothingToday}
            </p>
          </div>
          <div>
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Wallet className="h-3 w-3" /> {t.booking.revenue}
            </p>
            <p className="text-lg font-bold tabular-nums">{money(today.revenueCents)}</p>
            <p className="text-[11px] text-muted-foreground">{t.booking.todayLower}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => reset(() => setQuery(e.target.value))}
            placeholder={t.booking.searchBookingsPlaceholder}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 text-sm">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => reset(() => setFilter(f.key))}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  filter === f.key
                    ? "bg-emerald-500 text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            <button
              onClick={() => setView("list")}
              aria-label={t.booking.listView}
              aria-pressed={view === "list"}
              className={`inline-flex items-center justify-center rounded-md p-1.5 transition ${
                view === "list"
                  ? "bg-emerald-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("calendar")}
              aria-label={t.booking.calendarView}
              aria-pressed={view === "calendar"}
              className={`inline-flex items-center justify-center rounded-md p-1.5 transition ${
                view === "calendar"
                  ? "bg-emerald-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {view === "calendar" ? (
        <BookingsCalendar
          bookings={filtered}
          timezone={data.timezone}
          now={now}
          money={money}
          fmtDate={(iso) => fmtDate.format(new Date(iso))}
        />
      ) : (
        <>
      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        {shown.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {t.booking.noBookingsMatchFilters}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {shown.map((b) => {
              const upcoming = b.status === "confirmed" && new Date(b.starts_at).getTime() >= now;
              return (
                <BookingRow
                  key={b.id}
                  b={b}
                  money={money}
                  fmt={(iso) => fmtDate.format(new Date(iso))}
                  timezone={data.timezone}
                  cancellable={upcoming}
                  dim={!upcoming}
                />
              );
            })}
          </div>
        )}
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground tabular-nums">
            {t.booking.rangeOfTotal
              .replace("{start}", String(start + 1))
              .replace("{end}", String(Math.min(start + PAGE_SIZE, filtered.length)))
              .replace("{total}", String(filtered.length))}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium disabled:opacity-40 enabled:hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" /> {t.booking.prev}
            </button>
            <span className="text-sm text-muted-foreground tabular-nums">
              {current + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={current >= pageCount - 1}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium disabled:opacity-40 enabled:hover:bg-muted"
            >
              {t.booking.next} <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
