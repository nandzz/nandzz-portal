"use client";

import { CalendarDays, ChevronRight, X } from "lucide-react";
import type { WidgetBooking } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface NewBookingBannerProps {
  booking: WidgetBooking | null;
  timezone: string;
  onOpen: () => void;
  onDismiss: () => void;
}

function formatWhen(startsAt: string, timezone: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(startsAt));
  } catch {
    return new Date(startsAt).toLocaleString(locale);
  }
}

// Single in-page toast for a booking that lands while the owner has the
// dashboard open. No auto-dismiss timer — it stays until the owner closes it
// or a newer booking replaces it (WidgetWorkspace swaps `booking` in place).
// Inverted surface (dark on light, light on dark) so it stands out on the
// mostly-white dashboard in either theme.
export function NewBookingBanner({ booking, timezone, onOpen, onDismiss }: NewBookingBannerProps) {
  const { t, locale } = useLanguage();
  if (!booking) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-4 md:right-4 md:items-end">
      <div
        key={booking.id}
        role="status"
        className="group pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-2xl bg-neutral-950 p-3 pr-2 text-white shadow-2xl shadow-black/30 ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none dark:bg-white dark:text-neutral-950 dark:shadow-black/50 dark:ring-black/5"
      >
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-500/40">
            <CalendarDays className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-neutral-950 dark:ring-white" />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-sm font-semibold leading-snug">
              {t.notifications.newBooking.replace("{name}", booking.customer_name).replace("{service}", booking.service_name)}
            </span>
            <span className="mt-0.5 block text-xs text-white/65 dark:text-neutral-500">
              {formatWhen(booking.starts_at, timezone, locale)}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5 dark:text-neutral-400" />
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t.notifications.dismiss}
          className="shrink-0 self-start rounded-full p-1 text-white/50 transition hover:bg-white/10 hover:text-white dark:text-neutral-400 dark:hover:bg-black/5 dark:hover:text-neutral-950"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
