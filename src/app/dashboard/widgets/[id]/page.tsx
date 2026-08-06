export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnerWidgetById } from "@/lib/widgets/server";
import { normalizeCalendarConfig } from "@/lib/widgets/calendar";
import { renderWidgetIcon } from "@/components/widgets/widgetIcon";
import { WidgetWorkspace } from "@/components/widgets/calendar/WidgetWorkspace";
import type { WidgetOverviewData, OverviewBooking } from "@/components/widgets/calendar/WidgetOverview";
import type { WidgetBookingsData } from "@/components/widgets/calendar/WidgetBookings";
import type { WidgetCustomersData, CustomerSummary } from "@/components/widgets/calendar/WidgetCustomers";
import { ChevronLeft } from "lucide-react";
import type { WidgetBooking } from "@/lib/types";
import { getServerTranslations, getCurrentLocale } from "@/lib/i18n/server";

const CURRENCY_SYMBOLS: Record<string, string> = { usd: "$", eur: "€", gbp: "£" };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Monday 00:00 UTC of the week containing `d`. Weekly buckets are coarse enough
// that UTC anchoring (vs. the owner's tz) is fine for a volume trend.
function startOfWeekUtc(d: Date): number {
  const x = new Date(d);
  const dow = (x.getUTCDay() + 6) % 7; // Mon = 0
  x.setUTCDate(x.getUTCDate() - dow);
  x.setUTCHours(0, 0, 0, 0);
  return x.getTime();
}

function weekLabel(ms: number, locale: string): string {
  return new Date(ms).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function toOverviewBooking(b: WidgetBooking): OverviewBooking {
  return {
    id: b.id,
    instance_id: b.instance_id,
    service_id: b.service_id,
    customer_name: b.customer_name,
    customer_email: b.customer_email,
    service_name: b.service_name,
    starts_at: b.starts_at,
    price_cents: b.price_cents,
    status: b.status,
    customer_phone: b.customer_phone,
    manage_token: b.manage_token,
    staff_id: b.staff_id,
    staff_name: b.staff_name,
  };
}

function buildOverview(
  bookings: WidgetBooking[],
  timezone: string,
  currencySymbol: string,
  shareUrl: string | null,
  locale: string
): WidgetOverviewData {
  const now = Date.now();
  const confirmed = bookings.filter((b) => b.status === "confirmed");

  const upcomingCount = confirmed.filter((b) => new Date(b.starts_at).getTime() >= now).length;

  const in7 = now + WEEK_MS;
  const next7 = confirmed.filter((b) => {
    const t = new Date(b.starts_at).getTime();
    return t >= now && t < in7;
  }).length;

  const revenueCents = confirmed.reduce((sum, b) => sum + (b.price_cents ?? 0), 0);
  const cancelled = bookings.filter((b) => b.status === "cancelled").length;

  // Weekly volume: 6 weeks back through 1 week ahead (8 buckets).
  const currentWeek = startOfWeekUtc(new Date(now));
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const start = currentWeek + (i - 6) * WEEK_MS;
    const end = start + WEEK_MS;
    const count = confirmed.filter((b) => {
      const t = new Date(b.starts_at).getTime();
      return t >= start && t < end;
    }).length;
    return { label: weekLabel(start, locale), count, isFuture: start > currentWeek };
  });

  // Bookings by service.
  const byService = new Map<string, { count: number; revenueCents: number }>();
  for (const b of confirmed) {
    const cur = byService.get(b.service_name) ?? { count: 0, revenueCents: 0 };
    cur.count += 1;
    cur.revenueCents += b.price_cents ?? 0;
    byService.set(b.service_name, cur);
  }
  const services = [...byService.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count);

  return {
    timezone,
    currencySymbol,
    totals: {
      upcoming: upcomingCount,
      confirmedAllTime: confirmed.length,
      revenueCents,
      next7,
      cancelled,
    },
    weekly,
    services,
    shareUrl,
  };
}

// Full booking list for the Bookings tab, newest first. The tab paginates
// client-side, so the whole set is shipped once and sliced in the browser.
function buildBookings(
  bookings: WidgetBooking[],
  timezone: string,
  currencySymbol: string
): WidgetBookingsData {
  const sorted = [...bookings].sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return {
    timezone,
    currencySymbol,
    now: Date.now(),
    bookings: sorted.map(toOverviewBooking),
  };
}

// Roll bookings up per customer (keyed by email). Contact name/phone come from
// the customer's most recently created booking.
function buildCustomers(
  bookings: WidgetBooking[],
  timezone: string,
  currencySymbol: string
): WidgetCustomersData {
  const now = Date.now();

  const map = new Map<string, CustomerSummary>();
  const latestContact = new Map<string, number>(); // email → newest created_at ms

  for (const b of bookings) {
    const key = b.customer_email.trim().toLowerCase();
    if (!key) continue;
    const created = new Date(b.created_at).getTime();
    let c = map.get(key);
    if (!c) {
      c = {
        email: b.customer_email,
        name: b.customer_name,
        phone: b.customer_phone,
        bookings: 0,
        upcoming: 0,
        cancelled: 0,
        revenueCents: 0,
        lastVisit: null,
        nextVisit: null,
      };
      map.set(key, c);
    }

    // Freshest contact details win.
    if (created >= (latestContact.get(key) ?? -1)) {
      latestContact.set(key, created);
      c.name = b.customer_name;
      if (b.customer_phone) c.phone = b.customer_phone;
    }

    if (b.status === "cancelled") {
      c.cancelled += 1;
      continue;
    }

    // confirmed
    c.bookings += 1;
    c.revenueCents += b.price_cents ?? 0;
    const t = new Date(b.starts_at).getTime();
    if (t >= now) {
      c.upcoming += 1;
      if (!c.nextVisit || b.starts_at < c.nextVisit) c.nextVisit = b.starts_at;
    } else {
      if (!c.lastVisit || b.starts_at > c.lastVisit) c.lastVisit = b.starts_at;
    }
  }

  const customers = [...map.values()].sort(
      (a, b) =>
        b.upcoming - a.upcoming ||
        b.revenueCents - a.revenueCents ||
        b.bookings - a.bookings ||
        a.name.localeCompare(b.name)
    );

  return { timezone, currencySymbol, customers };
}

export default async function WidgetStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const widget = await getOwnerWidgetById(user.id, id);
  if (!widget) notFound();

  const isCalendar = widget.catalog.slug === "calendar";
  if (!isCalendar) notFound();

  const admin = createAdminClient();
  const [{ data: bookingRows }, { data: profile }, t, locale] = await Promise.all([
    admin
      .from("widget_bookings")
      .select("*")
      .eq("instance_id", id)
      .order("starts_at", { ascending: true }),
    admin.from("profiles").select("username").eq("id", user.id).maybeSingle(),
    getServerTranslations(),
    getCurrentLocale(),
  ]);

  const bookings = (bookingRows ?? []) as WidgetBooking[];
  const config = normalizeCalendarConfig(widget.config);
  const currencySymbol =
    CURRENCY_SYMBOLS[widget.catalog.currency?.toLowerCase()] ?? widget.catalog.currency?.toUpperCase() ?? "$";

  const canShare = widget.has_access && widget.enabled && !!profile?.username;
  const shareUrl = canShare ? `/${profile!.username}/widget/${id}` : null;

  const overview = buildOverview(bookings, config.timezone, currencySymbol, shareUrl, locale);
  const bookingList = buildBookings(bookings, config.timezone, currencySymbol);
  const customers = buildCustomers(bookings, config.timezone, currencySymbol);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/dashboard/widgets"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {t.booking.allWidgetsLink}
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
          {renderWidgetIcon(widget.catalog.icon, "h-5 w-5 text-emerald-600 dark:text-emerald-400")}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{widget.catalog.name}</h1>
          <p className="text-sm text-muted-foreground">
            {widget.has_access
              ? widget.enabled
                ? t.booking.liveOnProfile
                : t.booking.activeHiddenFromProfile
              : t.booking.inactiveSubscribe}
          </p>
        </div>
      </div>

      <WidgetWorkspace
        instanceId={widget.id}
        catalogId={widget.catalog_id}
        hasAccess={widget.has_access}
        enabled={widget.enabled}
        config={config}
        overview={overview}
        bookings={bookingList}
        customers={customers}
      />
    </div>
  );
}
