"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { Dialog } from "@/components/ui/dialog";
import { whatsappLink } from "@/lib/widgets/contact";
import { useLanguage } from "@/contexts/LanguageContext";
import type { BookingRowData } from "@/features/booking/components/calendar/BookingRow";
import type { CustomerSummary } from "@/features/booking/components/calendar/WidgetCustomers";

// Detail modal for one row of the Customers tab: contact info, the rollup stats
// the row already carries, and the customer's booking history (fetched on open
// from the dashboard route's `customer` view, scoped to the current location).

type Props = {
  customer: CustomerSummary | null;
  onClose: () => void;
  instanceId: string;
  locationId: string | null;
  timezone: string;
  money: (cents: number) => string;
};

export function CustomerDetailsDialog({ customer, onClose, instanceId, locationId, timezone, money }: Props) {
  const { t, locale } = useLanguage();
  // Keyed by customer id so a stale result never shows for a different customer;
  // `now` is captured at fetch time to split upcoming/past without impure renders.
  const [result, setResult] = useState<
    { id: string; bookings: BookingRowData[] | null; error: boolean; now: number } | null
  >(null);
  const customerId = customer?.id ?? null;
  const current = result && result.id === customerId ? result : null;
  const bookings = current?.bookings ?? null;
  const error = current?.error ?? false;

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    const qs = new URLSearchParams({ view: "customer", id: customerId, loc: locationId ?? "" });
    fetch(`/api/widgets/${instanceId}/dashboard?${qs.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<{ bookings: BookingRowData[] }>;
      })
      .then((data) => {
        if (!cancelled) setResult({ id: customerId, bookings: data.bookings, error: false, now: Date.now() });
      })
      .catch(() => {
        if (!cancelled) setResult({ id: customerId, bookings: null, error: true, now: Date.now() });
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, instanceId, locationId]);

  const fmtWhen = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale, timezone]
  );

  // Rows come newest-first. Upcoming reads soonest-first; past stays newest-first.
  const { upcoming, past } = useMemo(() => {
    const now = current?.now ?? 0;
    const list = bookings ?? [];
    return {
      upcoming: list.filter((b) => new Date(b.starts_at).getTime() >= now).reverse(),
      past: list.filter((b) => new Date(b.starts_at).getTime() < now),
    };
  }, [bookings, current?.now]);

  // Address isn't in the rollup — take the most recent one any booking carried.
  const address = useMemo(
    () => (bookings ?? []).find((b) => b.customer_address && b.customer_address.trim())?.customer_address ?? null,
    [bookings]
  );

  if (!customer) return null;

  const c = customer;
  const initials = c.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const firstName = c.name.split(" ")[0] || c.name;
  const wa = c.phone ? whatsappLink(c.phone, t.booking.whatsappSimpleGreeting.replace("{name}", firstName)) : null;

  const stats: { label: string; value: string }[] = [
    { label: t.booking.customerStatBookings, value: String(c.bookings) },
    { label: t.booking.filterUpcoming, value: String(c.upcoming) },
    { label: t.booking.filterCancelled, value: String(c.cancelled) },
    { label: t.booking.customerStatRevenue, value: money(c.revenueCents) },
  ];

  return (
    <Dialog open onClose={onClose} maxWidthClass="max-w-lg">
      <div className="-mt-2 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          {initials || "?"}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{c.name}</h2>
          {c.upcoming > 0 && (
            <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {t.booking.upcomingBadge.replace("{count}", String(c.upcoming))}
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-1">
        {c.email && (
          <ContactLine icon={<Mail className="h-4 w-4" />} href={`mailto:${c.email}`} label={c.email} />
        )}
        {c.phone && (
          <ContactLine
            icon={<Phone className="h-4 w-4" />}
            href={`tel:${c.phone}`}
            label={c.phone}
            trailing={
              wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/30"
                  aria-label={t.booking.whatsappAria.replace("{name}", c.name)}
                  title={t.booking.whatsappTitle}
                >
                  <WhatsAppIcon className="h-4 w-4" />
                </a>
              )
            }
          />
        )}
        {address && <ContactLine icon={<MapPin className="h-4 w-4" />} label={address} />}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border px-3 py-2.5">
            <p className="truncate text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-0.5 truncate text-base font-semibold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-6 text-sm font-semibold">{t.booking.customerHistoryTitle}</h3>
      <div className="mt-2 max-h-72 overflow-y-auto">
        {error ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t.booking.customerHistoryError}</p>
        ) : bookings === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t.booking.customerHistoryEmpty}</p>
        ) : (
          <div className="space-y-4">
            {upcoming.length > 0 && (
              <HistoryGroup label={t.booking.filterUpcoming}>
                {upcoming.map((b) => (
                  <HistoryItem key={b.id} b={b} when={fmtWhen.format(new Date(b.starts_at))} money={money} cancelledLabel={t.booking.cancelledBadge} />
                ))}
              </HistoryGroup>
            )}
            {past.length > 0 && (
              <HistoryGroup label={t.booking.filterPast}>
                {past.map((b) => (
                  <HistoryItem key={b.id} b={b} when={fmtWhen.format(new Date(b.starts_at))} money={money} cancelledLabel={t.booking.cancelledBadge} />
                ))}
              </HistoryGroup>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

function ContactLine({
  icon,
  label,
  href,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  trailing?: React.ReactNode;
}) {
  const body = (
    <>
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="truncate">{label}</span>
    </>
  );
  return (
    <div className="flex items-center gap-2">
      {href ? (
        <a href={href} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted">
          {body}
        </a>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-sm">{body}</div>
      )}
      {trailing}
    </div>
  );
}

function HistoryGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">{children}</div>
    </div>
  );
}

function HistoryItem({
  b,
  when,
  money,
  cancelledLabel,
}: {
  b: BookingRowData;
  when: string;
  money: (cents: number) => string;
  cancelledLabel: string;
}) {
  const services =
    b.services && b.services.length > 0
      ? b.services.map((s) => (s.staff_name ? `${s.name} · ${s.staff_name}` : s.name)).join(", ")
      : b.staff_name
        ? `${b.service_name} · ${b.staff_name}`
        : b.service_name;
  const cancelled = b.status === "cancelled";

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 ${cancelled ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium first-letter:uppercase">{when}</p>
        <p className="truncate text-xs text-muted-foreground">{services}</p>
      </div>
      {cancelled ? (
        <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {cancelledLabel}
        </span>
      ) : (
        b.price_cents != null && b.price_cents > 0 && (
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{money(b.price_cents)}</span>
        )
      )}
    </div>
  );
}
