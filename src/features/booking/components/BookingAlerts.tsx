"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarDays, CalendarX2, ChevronRight, X } from "lucide-react";
import type { Notification } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { subscribeToBookingNotifications } from "@/features/booking/realtime";
import { playBookingChime } from "@/features/booking/chime";
import { cn } from "@/lib/utils";

type BookingPayload = {
  customer_name: string;
  service_name: string;
  starts_at: string;
  timezone?: string;
  previous_starts_at?: string | null;
};

function formatWhen(startsAt: string, timezone: string | undefined, locale: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  try {
    return new Intl.DateTimeFormat(locale, { ...opts, timeZone: timezone }).format(new Date(startsAt));
  } catch {
    return new Intl.DateTimeFormat(locale, opts).format(new Date(startsAt));
  }
}

const KIND = {
  new_booking: { icon: CalendarDays, dot: "bg-emerald-500 shadow-emerald-500/40", ping: "bg-emerald-400" },
  booking_rescheduled: { icon: CalendarClock, dot: "bg-amber-500 shadow-amber-500/40", ping: "bg-amber-400" },
  booking_cancelled: { icon: CalendarX2, dot: "bg-rose-500 shadow-rose-500/40", ping: "bg-rose-400" },
} as const;

// App-wide booking alert — the in-app "notification center" toast. Mounted
// once in AppChrome for signed-in users, so a new / cancelled / rescheduled
// booking surfaces on every page, not only the booking dashboard. Fed by the
// owner's `notifications` rows (DB triggers on widget_bookings). No
// auto-dismiss: it stays until closed or replaced by a newer alert.
// Inverted surface so it stands out in either theme.
export function BookingAlerts({ userId }: { userId: string }) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [alert, setAlert] = useState<Notification | null>(null);

  useEffect(() => {
    return subscribeToBookingNotifications(userId, {
      onNotification: (n) => {
        setAlert(n);
        playBookingChime();
      },
    });
  }, [userId]);

  if (!alert) return null;
  const kind = KIND[alert.type as keyof typeof KIND];
  if (!kind) return null;
  const p = alert.payload as BookingPayload;
  const Icon = kind.icon;

  const template =
    alert.type === "booking_cancelled"
      ? t.notifications.bookingCancelled
      : alert.type === "booking_rescheduled"
        ? t.notifications.bookingRescheduled
        : t.notifications.newBooking;
  const title = template.replace("{name}", p.customer_name).replace("{service}", p.service_name);
  const when = formatWhen(p.starts_at, p.timezone, locale);
  const previous = p.previous_starts_at
    ? t.notifications.previousTime.replace("{when}", formatWhen(p.previous_starts_at, p.timezone, locale))
    : null;

  const open = () => {
    setAlert(null);
    router.push("/dashboard/booking/bookings");
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-4 md:right-4 md:items-end">
      <div
        key={alert.id}
        role="status"
        className="group pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-2xl bg-neutral-950 p-3 pr-2 text-white shadow-2xl shadow-black/30 ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none dark:bg-white dark:text-neutral-950 dark:shadow-black/50 dark:ring-black/5"
      >
        <button type="button" onClick={open} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
          <span className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm", kind.dot)}>
            <Icon className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 motion-reduce:animate-none", kind.ping)} />
              <span className={cn("relative inline-flex h-3 w-3 rounded-full ring-2 ring-neutral-950 dark:ring-white", kind.ping)} />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-sm font-semibold leading-snug">{title}</span>
            <span className={cn("mt-0.5 block text-xs text-white/65 dark:text-neutral-500", alert.type === "booking_cancelled" && "line-through")}>
              {when}
            </span>
            {previous && <span className="block text-xs text-white/45 dark:text-neutral-400">{previous}</span>}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5 dark:text-neutral-400" />
        </button>
        <button
          type="button"
          onClick={() => setAlert(null)}
          aria-label={t.notifications.dismiss}
          className="shrink-0 self-start rounded-full p-1 text-white/50 transition hover:bg-white/10 hover:text-white dark:text-neutral-400 dark:hover:bg-black/5 dark:hover:text-neutral-950"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
