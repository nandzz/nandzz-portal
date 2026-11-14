"use client";

import { useSyncExternalStore } from "react";
import { CalendarPlus } from "lucide-react";
import { googleCalendarUrl } from "@/features/booking/domain/ics";
import { useLanguage } from "@/contexts/LanguageContext";

// "Add to calendar" for a confirmed booking. The .ics link (served by
// /api/widgets/bookings/[token]/ics) carries 2 h + 1 h alerts and opens the
// native sheet on iPhone/Mac and Outlook/desktop apps. Google's link can't set
// reminders, so it falls back to the user's default Google reminders. Android
// visitors see Google first; everyone else sees the .ics first.

const subscribe = () => () => {};
const isAndroidClient = () => /android/i.test(navigator.userAgent);
const isAndroidServer = () => false;

export function AddToCalendar({
  calendarUrl,
  title,
  startIso,
  endIso,
  location,
  details,
}: {
  calendarUrl: string;
  title: string;
  startIso: string;
  endIso: string;
  location?: string;
  details?: string;
}) {
  const { t } = useLanguage();
  const android = useSyncExternalStore(subscribe, isAndroidClient, isAndroidServer);
  const google = googleCalendarUrl({ title, startIso, endIso, location, description: details });

  const btn =
    "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-muted";

  const ics = (
    <a key="ics" href={calendarUrl} className={btn}>
      <CalendarPlus className="h-4 w-4" /> {t.booking.addToAppleCalendar}
    </a>
  );
  const gcal = (
    <a key="google" href={google} target="_blank" rel="noopener noreferrer" className={btn}>
      <CalendarPlus className="h-4 w-4" /> {t.booking.addToGoogleCalendar}
    </a>
  );

  return (
    <div className="space-y-2 text-left">
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t.booking.addToCalendar}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">{android ? [gcal, ics] : [ics, gcal]}</div>
      <p className="text-center text-xs text-muted-foreground">{t.booking.calendarRemindersNote}</p>
    </div>
  );
}
