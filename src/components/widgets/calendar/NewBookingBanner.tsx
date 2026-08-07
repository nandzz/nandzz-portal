"use client";

import { CalendarDays, X } from "lucide-react";
import type { WidgetBooking } from "@/lib/types";
import { formatBookingTime } from "@/lib/widgets/emails";
import { useLanguage } from "@/contexts/LanguageContext";

interface NewBookingBannerProps {
  booking: WidgetBooking | null;
  timezone: string;
  onOpen: () => void;
  onDismiss: () => void;
}

// Single in-page toast for a booking that lands while the owner has the
// dashboard open. No auto-dismiss timer — it stays until the owner closes it
// or a newer booking replaces it (WidgetWorkspace swaps `booking` in place).
export function NewBookingBanner({ booking, timezone, onOpen, onDismiss }: NewBookingBannerProps) {
  const { t } = useLanguage();
  if (!booking) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-4 md:right-4 md:items-end">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-lg dark:border-emerald-900/50 dark:bg-neutral-900"
      >
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CalendarDays className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">
              {t.notifications.newBooking.replace("{name}", booking.customer_name).replace("{service}", booking.service_name)}
            </span>
            <span className="block text-xs text-muted-foreground">{formatBookingTime(booking.starts_at, timezone)}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t.notifications.dismiss}
          className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
