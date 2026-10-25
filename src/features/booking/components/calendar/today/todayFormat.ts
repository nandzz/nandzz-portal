"use client";

import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TodayBooking } from "@/features/booking/dashboardTypes";

// Formatting shared by the Today tab's pieces: everything renders in the
// location's timezone and the viewer's locale.

const DAY_MS = 24 * 60 * 60 * 1000;

export type TodayPhase = "done" | "live" | "upcoming" | "cancelled";

export function phaseOf(b: Pick<TodayBooking, "status" | "starts_at" | "ends_at">, now: number): TodayPhase {
  if (b.status === "cancelled") return "cancelled";
  const start = Date.parse(b.starts_at);
  const end = Date.parse(b.ends_at);
  if (now >= end) return "done";
  if (now >= start) return "live";
  return "upcoming";
}

// The booked services as "Service (Staff)" lines — the per-service breakdown
// when present, else the single aggregate line.
export function serviceLines(b: TodayBooking): { name: string; staff: string | null }[] {
  return b.services && b.services.length > 0
    ? b.services.map((s) => ({ name: s.name, staff: s.staff_name ?? b.staff_name ?? null }))
    : [{ name: b.service_name, staff: b.staff_name }];
}

export function useTodayFormat(timezone: string, currencySymbol: string) {
  const { t, locale } = useLanguage();
  return useMemo(() => {
    const time = new Intl.DateTimeFormat(locale, { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
    const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    const shortDay = new Intl.DateTimeFormat(locale, { timeZone: timezone, weekday: "short", day: "numeric", month: "short" });
    const monthYear = new Intl.DateTimeFormat(locale, { timeZone: timezone, month: "long", year: "numeric" });
    const longDate = new Intl.DateTimeFormat(locale, { timeZone: timezone, weekday: "long", day: "numeric", month: "long" });
    const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

    const money = (cents: number) =>
      `${currencySymbol}${(cents / 100).toLocaleString(locale, {
        minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      })}`;

    const duration = (min: number) => {
      const m = Math.max(0, Math.round(min));
      if (m < 60) return `${m} min`;
      const h = Math.floor(m / 60);
      const rest = m % 60;
      return rest ? `${h}h ${rest}m` : `${h}h`;
    };

    // "tra 25 min" / "tra 2 ore" — reuses the Bookings list's countdown copy.
    const countdown = (startMs: number, now: number) => {
      const delta = startMs - now;
      if (delta < 60 * 60_000) return t.booking.tagInMinutes.replace("{n}", String(Math.max(1, Math.ceil(delta / 60_000))));
      const n = Math.round(delta / (60 * 60_000));
      return n === 1 ? t.booking.tagInHour : t.booking.tagInHours.replace("{n}", String(n));
    };

    // Coarse "how long ago" for history: days, then weeks, months, years.
    const ago = (iso: string, now: number) => {
      const days = Math.max(1, Math.round((now - Date.parse(iso)) / DAY_MS));
      if (days < 7) return rtf.format(-days, "day");
      if (days < 60) return rtf.format(-Math.round(days / 7), "week");
      if (days < 365) return rtf.format(-Math.round(days / 30), "month");
      return rtf.format(-Math.round(days / 365), "year");
    };

    // A future date relative to today: "domani, 09:30" or "lun 27 ott, 09:30".
    const upcomingWhen = (iso: string, now: number) => {
      const d = new Date(iso);
      const key = dayKey.format(d);
      const day =
        key === dayKey.format(new Date(now + DAY_MS))
          ? rtf.format(1, "day")
          : key === dayKey.format(new Date(now))
            ? rtf.format(0, "day")
            : shortDay.format(d);
      return `${day}, ${time.format(d)}`;
    };

    // 0 = Monday … 6 = Sunday (2024-01-01 was a Monday).
    const weekday = (i: number) => weekdayFmt.format(new Date(Date.UTC(2024, 0, 1 + i)));

    return {
      time: (iso: string | number) => time.format(new Date(iso)),
      shortDay: (iso: string) => shortDay.format(new Date(iso)),
      monthYear: (iso: string) => monthYear.format(new Date(iso)),
      longDate: (iso: string | number) => longDate.format(new Date(iso)),
      money,
      duration,
      countdown,
      ago,
      upcomingWhen,
      weekday,
    };
  }, [locale, timezone, currencySymbol, t]);
}

export type TodayFormat = ReturnType<typeof useTodayFormat>;
