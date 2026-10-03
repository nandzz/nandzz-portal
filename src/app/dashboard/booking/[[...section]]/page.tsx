export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccountType } from "@/lib/account/server";
import { getOrCreateOwnerCalendar } from "@/features/booking/server";
import { normalizeCalendarConfig } from "@/lib/widgets/calendar";
import { currencySymbol } from "@/lib/widgets/messages";
import { renderWidgetIcon, WidgetWorkspace } from "@/features/booking";
import {
  fetchOverviewData,
  fetchCalendarData,
  fetchListData,
  fetchCustomersData,
} from "@/features/booking/dashboardData";
import { LocaleSelect } from "@/components/layout/LocaleSelect";
import { Settings } from "lucide-react";
import { getServerTranslations, getCurrentLocale } from "@/lib/i18n/server";
import { tabFromSegment } from "@/features/booking/widgetTabs";

const BASE_PATH = "/dashboard/booking";

// The Booking feature page. Booking is a single per-owner surface, so there's no
// instance id in the URL — the owner's calendar instance is fetched (and
// provisioned on first visit) server-side. Tab deep-links hang off the base path
// (`/dashboard/booking/{segment}`).
export default async function BookingDashboardPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);
  if (!userId) redirect("/login");

  // Business-only feature: personal accounts can't reach it by direct URL.
  if ((await getAccountType(supabase, userId)) !== "business") redirect("/dashboard/feed");

  // The tab lives in the path as a single segment; anything deeper, or an
  // unknown segment, isn't a real route.
  if (section && section.length > 1) notFound();
  const initialTab = tabFromSegment(section?.[0]);
  if (initialTab === null) notFound();

  const widget = await getOrCreateOwnerCalendar(userId);
  if (!widget) notFound();

  const admin = createAdminClient();
  const [t, locale, { data: profile }] = await Promise.all([
    getServerTranslations(),
    getCurrentLocale(),
    admin.from("profiles").select("username").eq("id", userId).maybeSingle(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-2">
          <LocaleSelect />
          <Link
            href={`${BASE_PATH}/settings`}
            aria-label={t.booking.widgetSettingsTitle}
            title={t.booking.widgetSettingsTitle}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <CalendarWorkspaceLoader
        instanceId={widget.id}
        hasAccess={widget.has_access}
        enabled={widget.enabled}
        config={widget.config}
        username={profile?.username}
        locale={locale}
        initialTab={initialTab}
      />
    </div>
  );
}

async function CalendarWorkspaceLoader({
  instanceId,
  hasAccess,
  enabled,
  config,
  username,
  locale,
  initialTab,
}: {
  instanceId: string;
  hasAccess: boolean;
  enabled: boolean;
  config: Record<string, unknown>;
  username?: string;
  locale: Awaited<ReturnType<typeof getCurrentLocale>>;
  initialTab: string;
}) {
  const normalizedConfig = normalizeCalendarConfig(config);
  const symbol = currencySymbol(normalizedConfig.currency);

  const canShare = hasAccess && enabled && !!username;
  const shareUrl = canShare ? `/${username}/booking/${instanceId}` : null;

  // Default the first-paint scope to the first location — this matches the
  // client's first render (before localStorage restores a prior pick), so the
  // seeded data lines up and the client only refetches if that pick differs.
  const locationId = normalizedConfig.locations[0]?.id ?? null;
  const location = locationId ? normalizedConfig.locations.find((l) => l.id === locationId) ?? null : null;
  const timezone = location?.timezone || normalizedConfig.timezone;
  const monthKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).format(new Date());

  // First-paint payload: every tab's initial slice, bounded — the same functions
  // the /dashboard API route serves for later interactions. Read through the
  // RLS-scoped session client (owner reads their own rows; the customers RPC
  // needs auth.uid()).
  const supabase = await createClient();
  const [overview, calendar, list, customers] = await Promise.all([
    fetchOverviewData(supabase, {
      instanceId,
      locationId,
      config: normalizedConfig,
      timezone,
      currencySymbol: symbol,
      locale,
      period: "month",
      shareUrl,
    }),
    fetchCalendarData(supabase, { instanceId, locationId, monthKey, timezone }),
    fetchListData(supabase, { instanceId, locationId, filter: "all", query: "", limit: 12, offset: 0 }),
    fetchCustomersData(supabase, { instanceId, locationId, timezone, currencySymbol: symbol }),
  ]);

  return (
    <Suspense>
      <WidgetWorkspace
        instanceId={instanceId}
        hasAccess={hasAccess}
        enabled={enabled}
        config={normalizedConfig}
        initial={{ locationId, overview, calendar, list, customers }}
        currencySymbol={symbol}
        shareUrl={shareUrl}
        initialTab={initialTab ?? "overview"}
        basePath={BASE_PATH}
      />
    </Suspense>
  );
}
