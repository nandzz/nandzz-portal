export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnerWidgetById } from "@/features/booking/server";
import { normalizeCalendarConfig } from "@/lib/widgets/calendar";
import { currencySymbol } from "@/lib/widgets/messages";
import { renderWidgetIcon, WidgetWorkspace, AgentWidgetWorkspace } from "@/features/booking";
import {
  fetchOverviewData,
  fetchCalendarData,
  fetchListData,
  fetchCustomersData,
} from "@/features/booking/dashboardData";
import { LocaleSelect } from "@/components/layout/LocaleSelect";
import { ChevronLeft } from "lucide-react";
import { getServerTranslations, getCurrentLocale } from "@/lib/i18n/server";
import { tabFromSegment } from "@/features/booking/widgetTabs";
import { getFeatureFlags } from "@/lib/featureFlags";

export default async function WidgetStudioPage({
  params,
}: {
  params: Promise<{ id: string; section?: string[] }>;
}) {
  const { id, section } = await params;
  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);
  if (!userId) redirect("/login");

  const widget = await getOwnerWidgetById(userId, id);
  if (!widget) notFound();

  const slug = widget.catalog.slug;
  if (slug !== "calendar" && slug !== "agent") notFound();
  // The agent widget is an AI surface — its workspace 404s while AI is off.
  if (slug === "agent" && !(await getFeatureFlags()).ai) notFound();

  // The tab lives in the path as a single segment
  // (`/dashboard/widgets/{id}/{segment}`); anything deeper, or an unknown
  // segment, isn't a real studio route. The agent widget has no tabbed
  // workspace, so it only serves its base path.
  if (section && section.length > 1) notFound();
  const sectionSeg = section?.[0];
  const initialTab = tabFromSegment(sectionSeg);
  if (slug === "agent") {
    if (sectionSeg) notFound();
  } else if (initialTab === null) {
    notFound();
  }

  const admin = createAdminClient();
  const [t, locale, { data: profile }] = await Promise.all([
    getServerTranslations(),
    getCurrentLocale(),
    admin.from("profiles").select("username").eq("id", userId).maybeSingle(),
  ]);

  const isAgent = slug === "agent";
  const iconBg = isAgent
    ? "bg-violet-100 dark:bg-violet-900/40"
    : "bg-emerald-100 dark:bg-emerald-900/40";
  const iconColor = isAgent
    ? "text-violet-600 dark:text-violet-400"
    : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/dashboard/widgets"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {t.booking.allWidgetsLink}
      </Link>

      <div className="mb-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
            {renderWidgetIcon(widget.catalog.icon, `h-5 w-5 ${iconColor}`)}
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
        <LocaleSelect />
      </div>

      {isAgent ? (
        <AgentWorkspaceLoader
          admin={admin}
          instanceId={widget.id}
          hasAccess={widget.has_access}
          enabled={widget.enabled}
          creditLimit={widget.catalog.monthly_credit_limit}
          username={profile?.username}
        />
      ) : (
        <CalendarWorkspaceLoader
          instanceId={widget.id}
          hasAccess={widget.has_access}
          enabled={widget.enabled}
          config={widget.config}
          username={profile?.username}
          locale={locale}
          initialTab={initialTab ?? "overview"}
        />
      )}
    </div>
  );
}

// Split per-slug so each loader only issues the query its own workspace
// needs (bookings for calendar, usage-period lookup for agent).

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
  const shareUrl = canShare ? `/${username}/widget/${instanceId}` : null;

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
        initialTab={initialTab}
      />
    </Suspense>
  );
}

async function AgentWorkspaceLoader({
  admin,
  instanceId,
  hasAccess,
  enabled,
  creditLimit,
  username,
}: {
  admin: ReturnType<typeof createAdminClient>;
  instanceId: string;
  hasAccess: boolean;
  enabled: boolean;
  creditLimit: number;
  username?: string;
}) {
  // Same billing-period bucket charge_agent_usage/agent_can_serve use, so the
  // number shown here always matches what's actually gating the chat.
  const { data: periodStart } = await admin.rpc("_agent_current_period", {
    p_instance_id: instanceId,
  });

  let creditsUsed = 0;
  if (periodStart) {
    const { data: usageRow } = await admin
      .from("widget_agent_usage")
      .select("credits_used")
      .eq("instance_id", instanceId)
      .eq("period_start", periodStart)
      .maybeSingle();
    creditsUsed = usageRow?.credits_used ?? 0;
  }

  const canPreview = hasAccess && enabled && !!username;
  const previewUrl = canPreview ? `/${username}/agent` : null;

  return (
    <Suspense>
      <AgentWidgetWorkspace
        instanceId={instanceId}
        hasAccess={hasAccess}
        initialEnabled={enabled}
        creditsUsed={creditsUsed}
        creditLimit={creditLimit}
        previewUrl={previewUrl}
      />
    </Suspense>
  );
}
