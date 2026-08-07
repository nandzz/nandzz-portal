import { createAdminClient } from "@/lib/supabase/admin";
import type { ViewsSeriesPoint, SpaceAnalytics } from "@/lib/types";
import { buildPeriodBuckets, type StatsPeriod, type PeriodBucket } from "@/lib/period";

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function buildViewsSeries(
  buckets: PeriodBucket[],
  views: { viewed_at: string }[]
): ViewsSeriesPoint[] {
  return buckets.map((bucket) => {
    const count = views.filter((v) => {
      const t = new Date(v.viewed_at).getTime();
      return t >= bucket.start && t < bucket.end;
    }).length;
    return { label: bucket.label, views: count };
  });
}

export async function getSpaceAnalytics(
  spaceId: string,
  locale: string,
  period: StatsPeriod = "month"
): Promise<SpaceAnalytics> {
  const admin = createAdminClient();
  const buckets = buildPeriodBuckets(period, locale);
  // views7d/views30d are fixed-window stats shown alongside the (variable) chart
  // period, so the fetch always has to cover at least the last 30 days too.
  const since = new Date(Math.min(buckets[0].start, Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString();

  const [{ data: space }, { data: views }, { count: total }] = await Promise.all([
    admin.from("spaces").select("likes_count, views_count").eq("id", spaceId).single(),
    admin
      .from("space_views")
      .select("viewed_at")
      .eq("space_id", spaceId)
      .gte("viewed_at", since),
    admin
      .from("space_views")
      .select("*", { count: "exact", head: true })
      .eq("space_id", spaceId),
  ]);

  const cutoff7d = new Date(daysAgoISO(7));
  const cutoff30d = new Date(daysAgoISO(30));
  const views7d = (views ?? []).filter((v) => new Date(v.viewed_at) >= cutoff7d).length;
  const views30d = (views ?? []).filter((v) => new Date(v.viewed_at) >= cutoff30d).length;

  return {
    spaceId,
    totalViews: total ?? space?.views_count ?? 0,
    views7d,
    views30d,
    viewsSeries: buildViewsSeries(buckets, views ?? []),
    likesCount: space?.likes_count ?? 0,
  };
}

export type SpaceSummary = {
  id: string;
  title: string;
  views_count: number;
  likes_count: number;
  views30d: number;
  views7d: number;
};

export type DashboardAnalytics = {
  totalViews: number;
  totalLikes: number;
  views7d: number;
  views30d: number;
  viewsSeries: ViewsSeriesPoint[];
  spaces: SpaceSummary[];
};

export async function getDashboardAnalytics(
  userId: string,
  locale: string,
  period: StatsPeriod = "month"
): Promise<DashboardAnalytics> {
  const admin = createAdminClient();
  const buckets = buildPeriodBuckets(period, locale);
  // views7d/views30d are fixed-window stats shown alongside the (variable) chart
  // period, so the fetch always has to cover at least the last 30 days too.
  const since = new Date(Math.min(buckets[0].start, Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString();

  const { data: spaces } = await admin
    .from("spaces")
    .select("id, title, views_count, likes_count")
    .eq("user_id", userId);

  if (!spaces || spaces.length === 0) {
    return {
      totalViews: 0,
      totalLikes: 0,
      views7d: 0,
      views30d: 0,
      viewsSeries: buildViewsSeries(buckets, []),
      spaces: [],
    };
  }

  const spaceIds = spaces.map((s) => s.id);
  const { data: recentViews } = await admin
    .from("space_views")
    .select("space_id, viewed_at")
    .in("space_id", spaceIds)
    .gte("viewed_at", since);

  const cutoff7d = new Date(daysAgoISO(7));
  const cutoff30d = new Date(daysAgoISO(30));

  // Per-space 30d/7d counters
  const viewsMap: Record<string, { views30d: number; views7d: number }> = {};
  for (const s of spaces) viewsMap[s.id] = { views30d: 0, views7d: 0 };

  for (const v of recentViews ?? []) {
    const viewedAt = new Date(v.viewed_at);
    if (viewedAt >= cutoff30d) viewsMap[v.space_id].views30d++;
    if (viewedAt >= cutoff7d) viewsMap[v.space_id].views7d++;
  }

  const totalViews = spaces.reduce((sum, s) => sum + (s.views_count ?? 0), 0);
  const totalLikes = spaces.reduce((sum, s) => sum + (s.likes_count ?? 0), 0);
  const views30d = (recentViews ?? []).filter((v) => new Date(v.viewed_at) >= cutoff30d).length;
  const views7d = (recentViews ?? []).filter((v) => new Date(v.viewed_at) >= cutoff7d).length;

  return {
    totalViews,
    totalLikes,
    views7d,
    views30d,
    viewsSeries: buildViewsSeries(buckets, recentViews ?? []),
    spaces: spaces.map((s) => ({
      id: s.id,
      title: s.title,
      views_count: s.views_count ?? 0,
      likes_count: s.likes_count ?? 0,
      views30d: viewsMap[s.id].views30d,
      views7d: viewsMap[s.id].views7d,
    })),
  };
}
