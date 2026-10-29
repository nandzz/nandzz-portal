"use client";

import { useMemo, useState } from "react";
import {
  Search,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  LayoutGrid,
  Plus,
  Loader2,
} from "lucide-react";
import { BookingRow, type BookingRowData } from "./BookingRow";
import { BookingsCalendar } from "./BookingsCalendar";
import { ManualBookingModal } from "./ManualBookingModal";
import type { CalendarCategory, CalendarService, StaffMember } from "@/lib/types";
import type { CalendarData, ListData, BookingsFilter } from "@/features/booking/dashboardTypes";
import { useLanguage } from "@/contexts/LanguageContext";

// Everything the owner's manual "New booking" flow needs, scoped to the
// currently-selected location (or the legacy top-level config when there are
// no locations). Passed down so the modal can reuse the availability + /book
// endpoints without re-deriving the location subtree.
export type ManualBookingScope = {
  instanceId: string;
  locationId: string | null;
  services: CalendarService[];
  categories: CalendarCategory[];
  staff: StaffMember[];
  showPrices: boolean;
};

const PAGE_SIZE = 12;

type View = "list" | "calendar";
// The calendar already lays out past and future, so its pills filter by status
// only; the time-based pills (upcoming/past) belong to the list view.
type CalendarStatus = "all" | "confirmed" | "cancelled";

// The Bookings tab. Data is windowed server-side: the calendar view renders one
// fetched month (search + status pills apply client-side over that bounded set),
// while the list view is fully server-driven — filter, search and pagination all
// resolve to a /dashboard?view=list request, so it scales to any volume.
export function WidgetBookings({
  timezone,
  currencySymbol,
  now,
  calendar,
  monthKey,
  onMonthChange,
  calendarLoading,
  list,
  page,
  onPageChange,
  listLoading,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  manual,
  onBooked,
}: {
  timezone: string;
  currencySymbol: string;
  now: number;
  calendar: CalendarData;
  monthKey: string;
  onMonthChange: (monthKey: string) => void;
  calendarLoading: boolean;
  list: ListData;
  page: number;
  onPageChange: (p: number) => void;
  listLoading: boolean;
  filter: BookingsFilter;
  onFilterChange: (f: BookingsFilter) => void;
  query: string;
  onQueryChange: (q: string) => void;
  manual: ManualBookingScope;
  onBooked: () => void;
}) {
  const { t, locale } = useLanguage();
  const FILTERS: { key: BookingsFilter; label: string }[] = [
    { key: "all", label: t.booking.filterAll },
    { key: "upcoming", label: t.booking.filterUpcoming },
    { key: "past", label: t.booking.filterPast },
    { key: "cancelled", label: t.booking.filterCancelled },
  ];
  const CALENDAR_FILTERS: { key: CalendarStatus; label: string }[] = [
    { key: "all", label: t.booking.filterAll },
    { key: "confirmed", label: t.booking.statusConfirmed },
    { key: "cancelled", label: t.booking.filterCancelled },
  ];
  const [view, setView] = useState<View>("list");
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>("all");
  // Manual booking modal: `modalDate` seeds the day when opened from a calendar
  // cell (null ⇒ the flow picks the first open day itself).
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<string | null>(null);

  function openManual(date: string | null = null) {
    setModalDate(date);
    setModalOpen(true);
  }

  const newBookingButton = (
    <button
      type="button"
      onClick={() => openManual(null)}
      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
    >
      <Plus className="h-4 w-4" /> {t.booking.newBooking}
    </button>
  );

  const manualModal = modalOpen && (
    <ManualBookingModal
      open
      onClose={() => setModalOpen(false)}
      instanceId={manual.instanceId}
      locationId={manual.locationId}
      services={manual.services}
      categories={manual.categories}
      staff={manual.staff}
      timezone={timezone}
      showPrices={manual.showPrices}
      currencySymbol={currencySymbol}
      initialDate={modalDate}
      onBooked={onBooked}
    />
  );

  const money = (cents: number) =>
    `${currencySymbol}${(cents / 100).toLocaleString(undefined, {
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;

  const fmtDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [timezone, locale]
  );

  // Calendar view applies search + status pills client-side over the single
  // fetched month grid — a bounded set, so this stays cheap at any total volume.
  const calendarFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return calendar.bookings.filter((b) => {
      if (calendarStatus !== "all" && b.status !== calendarStatus) return false;
      if (!q) return true;
      return (
        b.customer_name.toLowerCase().includes(q) ||
        b.customer_email.toLowerCase().includes(q) ||
        b.service_name.toLowerCase().includes(q)
      );
    });
  }, [calendar.bookings, calendarStatus, query]);

  // List view rows come already filtered, searched, ordered and paged from the
  // server; `list.total` drives the pager.
  const shown: BookingRowData[] = list.bookings;
  const pageCount = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const start = page * PAGE_SIZE;

  // Big "no bookings yet" state only in the neutral view (all + no search): with
  // windowed data that's the one case where an empty result means a truly empty
  // location, not just an over-narrow filter.
  const isGloballyEmpty = filter === "all" && query.trim() === "" && list.total === 0;

  if (isGloballyEmpty) {
    return (
      <div className="rounded-2xl border border-border bg-background px-5 py-12 text-center">
        <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium">{t.booking.noBookingsYetTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t.booking.noBookingsYetDesc}</p>
        <div className="mt-5 flex justify-center">{newBookingButton}</div>
        {manualModal}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">{newBookingButton}</div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t.booking.searchBookingsPlaceholder}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 text-sm">
            {view === "calendar"
              ? CALENDAR_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setCalendarStatus(f.key)}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      calendarStatus === f.key
                        ? "bg-emerald-500 text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))
              : FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => onFilterChange(f.key)}
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
        <div className={calendarLoading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={calendarLoading}>
          <BookingsCalendar
            bookings={calendarFiltered}
            allBookings={calendar.bookings}
            monthKey={monthKey}
            onMonthChange={onMonthChange}
            timezone={timezone}
            now={now}
            money={money}
            fmtDate={(iso) => fmtDate.format(new Date(iso))}
            onNewBooking={openManual}
            hasStaff={manual.staff.length > 0}
            onChanged={onBooked}
          />
        </div>
      ) : (
        <>
          <div
            className={`overflow-hidden rounded-2xl border border-border bg-background ${
              listLoading ? "opacity-60 transition-opacity" : "transition-opacity"
            }`}
            aria-busy={listLoading}
          >
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
                      timezone={timezone}
                      now={now}
                      cancellable={upcoming}
                      hasStaff={manual.staff.length > 0}
                      onChanged={onBooked}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {list.total > PAGE_SIZE && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground tabular-nums">
                {t.booking.rangeOfTotal
                  .replace("{start}", String(list.total === 0 ? 0 : start + 1))
                  .replace("{end}", String(start + shown.length))
                  .replace("{total}", String(list.total))}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPageChange(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium disabled:opacity-40 enabled:hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4" /> {t.booking.prev}
                </button>
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
                  {listLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {page + 1} / {pageCount}
                </span>
                <button
                  onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
                  disabled={page >= pageCount - 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium disabled:opacity-40 enabled:hover:bg-muted"
                >
                  {t.booking.next} <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {manualModal}
    </div>
  );
}
