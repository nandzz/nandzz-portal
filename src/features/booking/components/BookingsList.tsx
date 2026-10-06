"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, MapPin, ExternalLink, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";
import type { BookerBooking, BookingFilter } from "@/features/booking/data/booker-bookings";

export type { BookerBooking } from "@/features/booking/data/booker-bookings";

type Filter = BookingFilter;

// Per-filter pagination bucket. Each filter loads its own pages lazily from
// /api/bookings the first time it's opened, then appends on "load more".
type Bucket = {
  items: BookerBooking[];
  offset: number;
  hasMore: boolean;
  loaded: boolean;
  loading: boolean;
};

const emptyBucket: Bucket = { items: [], offset: 0, hasMore: false, loaded: false, loading: false };

export function BookingsList({
  initialBookings,
  initialHasMore,
  hasAnyBookings,
  now,
  locale,
}: {
  initialBookings: BookerBooking[];
  initialHasMore: boolean;
  hasAnyBookings: boolean;
  now: number; // server request time (ms) — the stable upcoming/past anchor
  locale: string;
}) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [buckets, setBuckets] = useState<Record<Filter, Bucket>>({
    upcoming: {
      items: initialBookings,
      offset: initialBookings.length,
      hasMore: initialHasMore,
      loaded: true,
      loading: false,
    },
    past: { ...emptyBucket },
    cancelled: { ...emptyBucket },
  });

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "upcoming", label: t.booking.filterUpcoming },
    { key: "past", label: t.booking.filterPast },
    { key: "cancelled", label: t.booking.filterCancelled },
  ];

  const load = useCallback(
    async (f: Filter, mode: "replace" | "append") => {
      setBuckets((prev) => ({ ...prev, [f]: { ...prev[f], loading: true } }));
      const offset = mode === "append" ? buckets[f].offset : 0;
      try {
        const res = await fetch(`/api/bookings?filter=${f}&offset=${offset}&now=${now}`);
        const json = (await res.json()) as { bookings: BookerBooking[]; hasMore: boolean };
        const newItems = json.bookings ?? [];
        setBuckets((prev) => {
          const base = mode === "append" ? prev[f].items : [];
          return {
            ...prev,
            [f]: {
              items: [...base, ...newItems],
              offset: base.length + newItems.length,
              hasMore: !!json.hasMore,
              loaded: true,
              loading: false,
            },
          };
        });
      } catch {
        setBuckets((prev) => ({ ...prev, [f]: { ...prev[f], loading: false, loaded: true } }));
      }
    },
    [buckets, now]
  );

  const handleFilter = (f: Filter) => {
    setFilter(f);
    if (!buckets[f].loaded && !buckets[f].loading) load(f, "replace");
  };

  const active = buckets[filter];

  if (!hasAnyBookings) {
    return (
      <div className="rounded-2xl border border-border bg-background px-5 py-12 text-center">
        <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium">{t.booking.myBookingsEmptyTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t.booking.myBookingsEmptyDesc}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex w-fit items-center gap-1 rounded-lg border border-border p-0.5 text-sm">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => handleFilter(f.key)}
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

      {!active.loaded && active.loading ? (
        <div className="flex justify-center rounded-2xl border border-border bg-background py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : active.items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-background px-5 py-12 text-center text-sm text-muted-foreground">
          {t.booking.noBookingsMatchFilters}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
            {active.items.map((b) => (
              <BookerBookingRow key={b.id} b={b} locale={locale} now={now} />
            ))}
          </div>

          {active.hasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => load(filter, "append")}
                disabled={active.loading}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {active.loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.profile.loadMore}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BookerBookingRow({
  b,
  locale,
  now,
}: {
  b: BookerBooking;
  locale: string;
  now: number;
}) {
  const { t } = useLanguage();

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: b.timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [locale, b.timezone]
  );

  const when = fmt.format(new Date(b.starts_at));
  const businessName =
    b.business?.display_name || b.business?.username || t.booking.unknownBusiness;
  const cancelled = b.status === "cancelled";
  const isPast = !cancelled && new Date(b.starts_at).getTime() < now;

  const money =
    b.price_cents != null && b.price_cents > 0
      ? `${b.currencySymbol}${(b.price_cents / 100).toLocaleString(undefined, {
          minimumFractionDigits: b.price_cents % 100 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        })}`
      : null;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-5 py-3.5 ${
        cancelled || isPast ? "opacity-70" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={b.business?.avatar_url || undefined} alt="" />
          <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-sm">
            {businessName[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium">{businessName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm text-muted-foreground">{b.service_name}</p>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Clock className="h-3 w-3" />
              {when}
            </span>
          </div>
          {(b.staff_name || b.location_name) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {b.staff_name && (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar size="sm" className="h-4 w-4">
                    <AvatarImage src={undefined} />
                    <AvatarFallback className="text-[9px]">
                      {b.staff_name[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  {b.staff_name}
                </span>
              )}
              {b.location_name && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {b.location_name}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {cancelled && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
            {t.booking.cancelledBadge}
          </span>
        )}
        {money && (
          <span className="hidden text-sm font-medium tabular-nums sm:inline">{money}</span>
        )}
        <Link
          href={`/booking/${b.manage_token}`}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-emerald-400 hover:text-emerald-600"
        >
          {t.booking.manageBookingCta}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
