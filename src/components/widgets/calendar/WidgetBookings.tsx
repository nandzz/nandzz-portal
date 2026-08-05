"use client";

import { useMemo, useState } from "react";
import { Search, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { BookingRow, type BookingRowData } from "./BookingRow";

export type WidgetBookingsData = {
  timezone: string;
  currencySymbol: string;
  now: number; // server request time (ms) — anchors upcoming/past filtering
  bookings: BookingRowData[]; // all bookings, newest first
};

const PAGE_SIZE = 12;

type Filter = "all" | "upcoming" | "past" | "cancelled";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
];

export function WidgetBookings({ data }: { data: WidgetBookingsData }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);

  const now = data.now;

  const money = (cents: number) =>
    `${data.currencySymbol}${(cents / 100).toLocaleString(undefined, {
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;

  const fmtDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: data.timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [data.timezone]
  );

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
        <p className="mt-3 text-sm font-medium">No bookings yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Every appointment booked through your widget will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => reset(() => setQuery(e.target.value))}
            placeholder="Search bookings…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400"
          />
        </div>
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
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        {shown.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No bookings match your filters.
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
            {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium disabled:opacity-40 enabled:hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="text-sm text-muted-foreground tabular-nums">
              {current + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={current >= pageCount - 1}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium disabled:opacity-40 enabled:hover:bg-muted"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
