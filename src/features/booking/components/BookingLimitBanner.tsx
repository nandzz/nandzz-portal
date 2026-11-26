import Link from "next/link";
import { AlertTriangle, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Locale, Translations } from "@/lib/i18n/translations";

// Share of the cap at which the owner gets an early heads-up.
const WARN_AT = 0.8;

// Owner-facing notice on the booking dashboard for the plan's monthly cap on
// customer bookings: a heads-up from 80%, and a clear "link paused" state once
// reached. Renders nothing for unlimited plans or below the threshold.
export function BookingLimitBanner({
  t,
  locale,
  limit,
  used,
  reached,
}: {
  t: Translations;
  locale: Locale;
  limit: number | null;
  used: number;
  reached: boolean;
}) {
  if (limit == null || (!reached && used < Math.ceil(limit * WARN_AT))) return null;

  // The count resets on the 1st of next month (UTC, same as the DB).
  const now = new Date();
  const resetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(resetAt);
  const fill = (s: string) =>
    s.replace("{used}", String(Math.min(used, limit))).replace(/\{limit\}/g, String(limit)).replace("{date}", date);
  const Icon = reached ? AlertTriangle : Gauge;

  return (
    <div
      role={reached ? "alert" : "status"}
      className={cn(
        "mb-6 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
        reached
          ? "border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30"
          : "border-border bg-muted/40",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          aria-hidden
          className={cn("mt-0.5 h-5 w-5 shrink-0", reached ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}
        />
        <div>
          <p className="text-sm font-semibold">
            {reached ? t.booking.limitBannerReachedTitle : fill(t.booking.limitBannerNearTitle)}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {fill(reached ? t.booking.limitBannerReachedBody : t.booking.limitBannerNearBody)}
          </p>
        </div>
      </div>
      <Link
        href="/dashboard/subscription"
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {t.booking.limitBannerUpgrade}
      </Link>
    </div>
  );
}
