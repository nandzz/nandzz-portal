export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSpaceAnalytics } from "@/lib/analytics";
import { ViewsChart } from "@/components/analytics/ViewsChart";
import { AnalyticsPeriodControl } from "@/components/analytics/AnalyticsPeriodControl";
import { BackButton } from "@/components/ui/BackButton";
import { Eye, Heart, TrendingUp, BarChart2 } from "lucide-react";
import { getServerTranslations, getCurrentLocale } from "@/lib/i18n/server";
import { parseStatsPeriod } from "@/lib/period";

export default async function SpaceAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { spaceId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: space } = await supabase
    .from("spaces")
    .select("id, title, user_id")
    .eq("id", spaceId)
    .single();

  if (!space || space.user_id !== user.id) notFound();

  const period = parseStatsPeriod((await searchParams).period);
  const locale = await getCurrentLocale();
  const [analytics, t] = await Promise.all([
    getSpaceAnalytics(spaceId, locale, period),
    getServerTranslations(),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton />
        <div className="h-4 w-px bg-border" />
        <BarChart2 className="h-4 w-4 text-violet-500 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{space.title}</h1>
          <Link
            href="/dashboard/analytics"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t.go.allSpaces}
          </Link>
        </div>
      </div>

      {analytics && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Eye className="h-4 w-4" />} label={t.analytics.totalViews} value={analytics.totalViews} />
            <StatCard icon={<TrendingUp className="h-4 w-4" />} label={t.analytics.views30d} value={analytics.views30d} />
            <StatCard icon={<TrendingUp className="h-4 w-4" />} label={t.analytics.views7d} value={analytics.views7d} />
            <StatCard icon={<Heart className="h-4 w-4" />} label={t.analytics.totalLikes} value={analytics.likesCount} />
          </div>

          {/* Chart */}
          <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-muted-foreground">{t.analytics.chartViews}</h2>
                {analytics.viewsSeries.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {analytics.viewsSeries[0].label} –{" "}
                    {analytics.viewsSeries[analytics.viewsSeries.length - 1].label}
                  </p>
                )}
              </div>
              <AnalyticsPeriodControl period={period} />
            </div>
            <ViewsChart data={analytics.viewsSeries} />
          </div>
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
