export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDashboardAnalytics } from "@/lib/analytics";
import { ViewsChart } from "@/components/analytics/ViewsChart";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/button";
import { BarChart2, Eye, Heart, TrendingUp, ExternalLink } from "lucide-react";

export default async function AnalyticsDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const analytics = await getDashboardAnalytics(user.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton />
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-violet-500" />
          <h1 className="text-xl font-bold">Analytics</h1>
        </div>
      </div>

      {analytics && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Eye className="h-4 w-4" />}
              label="Total views"
              value={analytics.totalViews}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Views (30d)"
              value={analytics.views30d}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Views (7d)"
              value={analytics.views7d}
            />
            <StatCard
              icon={<Heart className="h-4 w-4" />}
              label="Total likes"
              value={analytics.totalLikes}
            />
          </div>

          {/* Daily chart */}
          <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Views — last 30 days</h2>
            <ViewsChart data={analytics.dailyViews} />
          </div>

          {/* Per-space table */}
          {analytics.spaces.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border/60">
                <h2 className="text-sm font-medium">Spaces</h2>
              </div>
              <div className="divide-y divide-border/40">
                {analytics.spaces
                  .slice()
                  .sort((a, b) => b.views_count - a.views_count)
                  .map((space) => (
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
