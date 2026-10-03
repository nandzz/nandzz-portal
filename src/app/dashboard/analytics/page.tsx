export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { getAccountType } from "@/lib/account/server";
import { getDashboardAnalytics, getProfileVisitorAnalytics } from "@/features/analytics/server";
import { ViewsChart, AnalyticsPeriodControl } from "@/features/analytics";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/button";
import {
  BarChart2,
  Eye,
  Heart,
  TrendingUp,
  ExternalLink,
  Users,
  MousePointerClick,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getServerTranslations, getCurrentLocale } from "@/lib/i18n/server";
import { getUserEntitlements } from "@/lib/plan";
import { FeatureGate } from "@/components/plan/FeatureGate";
import { parseStatsPeriod } from "@/lib/period";

export default async function AnalyticsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; page?: string }>;
}) {
  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);
  if (!userId) redirect("/login");

  // Business-only section (matches the nav gating): personal accounts can't
  // reach Analytics by direct URL.
  if ((await getAccountType(supabase, userId)) !== "business") redirect("/dashboard/feed");

  const entitlements = await getUserEntitlements(userId);
  const t = await getServerTranslations();
  if (!entitlements.hasAnalytics) {
    return (
      <FeatureGate
        title={t.plan.analyticsLockedTitle}
        description={t.plan.analyticsLocked}
        ctaLabel={t.plan.upgradeToPro}
      />
    );
  }

  const params = await searchParams;
  const period = parseStatsPeriod(params.period);
  const page = Math.max(1, Number(params.page) || 1);
  const locale = await getCurrentLocale();
  const [analytics, visitors] = await Promise.all([
    getDashboardAnalytics(userId, locale, period, page),
    getProfileVisitorAnalytics(userId, locale, period),
  ]);
  const rangeLabel =
    visitors.visitorsSeries.length > 0
      ? `${visitors.visitorsSeries[0].label} – ${visitors.visitorsSeries[visitors.visitorsSeries.length - 1].label}`
      : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-violet-500" />
            <h1 className="text-xl font-bold">{t.analytics.title}</h1>
          </div>
        </div>
        <AnalyticsPeriodControl period={period} />
      </div>

      {/* Profile visitors (selected period) */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">{t.analytics.profileSection}</h2>
          <p className="text-xs text-muted-foreground">
            {t.analytics.profileSectionHint}
            {rangeLabel && <> · {rangeLabel}</>}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
          <div className="flex flex-wrap gap-x-10 gap-y-3">
            <InlineStat
              icon={<Users className="h-4 w-4" />}
              label={t.analytics.uniqueVisitors}
              value={visitors.uniqueVisitors}
            />
            <InlineStat
              icon={<MousePointerClick className="h-4 w-4" />}
              label={t.analytics.profileVisits}
              value={visitors.visits}
            />
          </div>
          <ViewsChart
            data={visitors.visitorsSeries}
            unitLabel={t.analytics.uniqueVisitors}
            color="hsl(160 60% 45%)"
          />
        </div>
      </section>

      <h2 className="text-base font-semibold -mb-5">{t.analytics.contentSection}</h2>

      {analytics && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Eye className="h-4 w-4" />} label={t.analytics.totalViews} value={analytics.totalViews} />
            <StatCard icon={<TrendingUp className="h-4 w-4" />} label={t.analytics.views30d} value={analytics.views30d} />
            <StatCard icon={<TrendingUp className="h-4 w-4" />} label={t.analytics.views7d} value={analytics.views7d} />
            <StatCard icon={<Heart className="h-4 w-4" />} label={t.analytics.totalLikes} value={analytics.totalLikes} />
          </div>

          {/* Views chart */}
          <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">{t.analytics.chartViews}</h2>
            <ViewsChart data={analytics.viewsSeries} unitLabel={t.analytics.chartViews} />
          </div>

          {/* Per-space table */}
          {analytics.spaces.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border/60">
                <h2 className="text-sm font-medium">{t.analytics.spacesTable}</h2>
              </div>
              <div className="divide-y divide-border/40">
                {analytics.spaces.map((space) => (
                  <div
                    key={space.id}
                    className="flex items-center justify-between px-5 py-3 gap-4 text-sm"
                  >
                    <span className="truncate font-medium flex-1">{space.title}</span>
                    <div className="flex items-center gap-6 text-muted-foreground shrink-0">
                      <span className="hidden sm:block w-16 text-right">
                        <span className="text-foreground font-medium">{space.views7d}</span> 7d
                      </span>
                      <span className="w-16 text-right">
                        <span className="text-foreground font-medium">{space.views30d}</span> 30d
                      </span>
                      <span className="hidden sm:flex items-center gap-1 w-20 text-right justify-end">
                        <Eye className="h-3 w-3" />
                        <span className="text-foreground font-medium">{space.views_count}</span>
                      </span>
                      <span className="hidden sm:flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        <span className="text-foreground font-medium">{space.likes_count}</span>
                      </span>
                      <Link href={`/dashboard/analytics/${space.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              {analytics.totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border/60">
                  <p className="text-xs text-muted-foreground">
                    {t.subscription.pageOf
                      .replace("{page}", String(analytics.page))
                      .replace("{total}", String(analytics.totalPages))}
                  </p>
                  <div className="flex items-center gap-2">
                    <PageLink page={analytics.page - 1} period={period} disabled={analytics.page <= 1}>
                      <ChevronLeft className="h-4 w-4" /> {t.subscription.prev}
                    </PageLink>
                    <PageLink
                      page={analytics.page + 1}
                      period={period}
                      disabled={analytics.page >= analytics.totalPages}
                    >
                      {t.subscription.next} <ChevronRight className="h-4 w-4" />
                    </PageLink>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function InlineStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function PageLink({
  page,
  period,
  disabled,
  children,
}: {
  page: number;
  period: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const button = (
    <Button variant="outline" size="sm" className="gap-1" disabled={disabled}>
      {children}
    </Button>
  );
  if (disabled) return button;
  return (
    <Link href={`/dashboard/analytics?period=${period}&page=${page}`} scroll={false}>
      {button}
    </Link>
  );
}
