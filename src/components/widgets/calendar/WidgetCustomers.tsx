"use client";

import { useMemo, useState } from "react";
import { Search, MessageCircle, Mail, Users } from "lucide-react";
import { whatsappLink } from "@/lib/widgets/contact";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Translations } from "@/lib/i18n/translations";

export type CustomerSummary = {
  email: string;
  name: string;
  phone: string | null;
  bookings: number; // confirmed, all time
  upcoming: number;
  cancelled: number;
  revenueCents: number;
  lastVisit: string | null; // ISO — most recent confirmed in the past
  nextVisit: string | null; // ISO — soonest upcoming confirmed
};

export type WidgetCustomersData = {
  timezone: string;
  currencySymbol: string;
  customers: CustomerSummary[];
};

export function WidgetCustomers({ data }: { data: WidgetCustomersData }) {
  const { t, locale } = useLanguage();
  const [query, setQuery] = useState("");

  const money = (cents: number) =>
    `${data.currencySymbol}${(cents / 100).toLocaleString(undefined, {
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;

  const fmtDay = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: data.timezone,
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [data.timezone, locale]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.customers;
    return data.customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q)
    );
  }, [data.customers, query]);

  if (data.customers.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background px-5 py-12 text-center">
        <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium">{t.booking.noCustomersYetTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t.booking.noCustomersYetDesc}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.booking.searchCustomersPlaceholder}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400"
          />
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">
          {data.customers.length}{" "}
          {data.customers.length === 1 ? t.booking.customerSingular : t.booking.customerPlural}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        <div className="divide-y divide-border">
          {filtered.map((c) => (
            <CustomerRow
              key={c.email}
              c={c}
              money={money}
              fmtDay={(iso) => fmtDay.format(new Date(iso))}
              t={t}
            />
          ))}
          {filtered.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              {t.booking.noCustomersMatch.replace("{query}", query)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomerRow({
  c,
  money,
  fmtDay,
  t,
}: {
  c: CustomerSummary;
  money: (cents: number) => string;
  fmtDay: (iso: string) => string;
  t: Translations;
}) {
  const initials = c.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const firstName = c.name.split(" ")[0] || c.name;
  const wa = c.phone ? whatsappLink(c.phone, t.booking.whatsappSimpleGreeting.replace("{name}", firstName)) : null;

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        {initials || "?"}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{c.name}</p>
          {c.upcoming > 0 && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {t.booking.upcomingBadge.replace("{count}", String(c.upcoming))}
            </span>
          )}
        </div>
        <p className="truncate text-sm text-muted-foreground">{c.email}</p>
      </div>

      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium tabular-nums">
          {c.bookings} {c.bookings === 1 ? t.booking.bookingCountSingular : t.booking.bookingCountPlural}
        </p>
        <p className="text-xs text-muted-foreground">
          {c.nextVisit
            ? t.booking.nextVisit.replace("{date}", fmtDay(c.nextVisit))
            : c.lastVisit
              ? t.booking.lastVisit.replace("{date}", fmtDay(c.lastVisit))
              : "—"}
        </p>
      </div>

      {c.revenueCents > 0 && (
        <div className="hidden w-24 text-right md:block">
          <p className="text-sm font-medium tabular-nums">{money(c.revenueCents)}</p>
          <p className="text-xs text-muted-foreground">{t.booking.revenueLower}</p>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1.5">
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/30"
            aria-label={t.booking.whatsappAria.replace("{name}", c.name)}
            title={t.booking.whatsappTitle}
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        )}
        <a
          href={`mailto:${c.email}`}
          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label={t.booking.emailAria.replace("{name}", c.name)}
          title={t.booking.emailTitle}
        >
          <Mail className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
