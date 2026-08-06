"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Pencil } from "lucide-react";
import { todayInZone, type Slot } from "@/lib/widgets/calendar";
import { MonthCalendar, CalendarSkeleton } from "./MonthCalendar";
import { useLanguage } from "@/contexts/LanguageContext";

// Availability-aware "pick a new time" picker, shared by the customer self-serve
// manage page (ManageBooking) and the owner dashboard (BookingRow). It fetches
// open slots for one service on one instance, renders a month grid + a time
// picker for the chosen day, and hands the chosen slot back via `onPick`. The
// parent owns the commit (PATCH) and shows any commit error via `busy`/`error`.
//
// Matches the main booking flow's window; the availability API caps `days` at 60.
const BOOKING_WINDOW_DAYS = 60;

export function ReschedulePicker({
  instanceId,
  serviceId,
  timezone,
  busy,
  error,
  onPick,
}: {
  instanceId: string;
  serviceId: string;
  timezone: string;
  busy?: boolean;
  error?: string | null; // commit error, owned by the parent
  onPick: (slot: Slot) => void;
}) {
  const { t, locale } = useLanguage();
  const tz = timezone;
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Whether the full month grid is showing. Collapses to a compact summary once
  // the user actively picks a day (auto-selecting the first day keeps it open).
  const [calendarOpen, setCalendarOpen] = useState(true);

  // Fetch availability for the service once, on mount. The picker mounts fresh
  // each time it opens, so initial state already reflects the loading defaults —
  // no synchronous reset needed here.
  useEffect(() => {
    let active = true;
    fetch(
      `/api/widgets/${instanceId}/availability?service_id=${encodeURIComponent(
        serviceId
      )}&days=${BOOKING_WINDOW_DAYS}`
    )
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setSlots([]);
          setLoadError(t.booking.errorLoadAvailability);
        } else {
          setSlots(data.slots ?? []);
        }
      })
      .catch(() => {
        if (active) setLoadError(t.booking.errorLoadAvailability);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [instanceId, serviceId]);

  const fmtDay = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(
      new Date(iso)
    );

  // Civil date ("YYYY-MM-DD") of an ISO instant in the widget timezone — the key
  // the calendar groups slots by. en-CA yields ISO-ordered output.
  const dateKeyFmt = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    [tz]
  );

  // Group slots by civil date (in the widget tz) for the calendar + time picker.
  const slotsByDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = dateKeyFmt.format(new Date(s.start));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    // Slots arrive chronologically from the API, so each day's list already is.
    return map;
  }, [slots, dateKeyFmt]);

  const availableDates = useMemo(() => new Set(slotsByDate.keys()), [slotsByDate]);

  // Calendar bounds: today (owner tz) through the end of the booking window.
  const minDate = useMemo(() => todayInZone(tz), [tz]);
  const maxDate = useMemo(() => {
    const [y, m, d] = minDate.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + BOOKING_WINDOW_DAYS - 1, 12)).toISOString().slice(0, 10);
  }, [minDate]);

  // Land on the first bookable date so the time picker isn't empty on arrival —
  // derived, not stored, until the user picks one (`selectedDate`) themselves.
  const firstAvailable = useMemo(() => [...availableDates].sort()[0] ?? null, [availableDates]);
  const activeDate = selectedDate ?? firstAvailable;

  const daySlots = activeDate ? slotsByDate.get(activeDate) ?? [] : [];
  const activeDateLabel = activeDate ? fmtDay(`${activeDate}T12:00:00Z`) : "";

  // User actively chose a day → collapse the grid into the summary bar.
  function pickDate(key: string) {
    setSelectedDate(key);
    setCalendarOpen(false);
  }

  if (loading) return <CalendarSkeleton />;

  if (loadError) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
        {loadError}
      </p>
    );
  }

  if (availableDates.size === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t.booking.noOpenSlots.replace("{days}", String(BOOKING_WINDOW_DAYS))}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {calendarOpen ? (
        <MonthCalendar
          availableDates={availableDates}
          selected={activeDate}
          onSelect={pickDate}
          minDate={minDate}
          maxDate={maxDate}
          countFor={(key) => slotsByDate.get(key)?.length ?? 0}
        />
      ) : (
        <button
          onClick={() => setCalendarOpen(true)}
          aria-label={t.booking.selectedDateChange.replace("{date}", activeDateLabel)}
          className="cursor-pointer flex w-full items-center justify-between rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3 text-left transition hover:border-emerald-400"
        >
          <span className="flex items-center gap-2.5">
            <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium">{activeDateLabel}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
            <Pencil className="h-3.5 w-3.5" /> {t.booking.change}
          </span>
        </button>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      <div>
        {activeDate ? (
          <>
            {calendarOpen && (
              <p className="mb-2 text-xs font-medium text-muted-foreground">{activeDateLabel}</p>
            )}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {daySlots.map((s) => (
                <button
                  key={s.start}
                  disabled={busy}
                  onClick={() => onPick(s)}
                  className="rounded-lg border border-border px-2 py-2 text-sm transition hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-emerald-950/30"
                >
                  {fmtTime(s.start)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t.booking.selectDateToSeeTimes}</p>
        )}
      </div>
    </div>
  );
}
