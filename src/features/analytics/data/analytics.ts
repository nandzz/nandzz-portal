import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ViewsSeriesPoint, SpaceAnalytics } from "@/lib/types";
import { buildPeriodBuckets, type StatsPeriod, type PeriodBucket } from "@/lib/period";

// Chart bucket boundaries for the SQL aggregates: n buckets → n+1 timestamps.
function bucketBounds(buckets: PeriodBucket[]): string[] {
  return [...buckets.map((b) => b.start), buckets[buckets.length - 1].end].map((ms) =>
    new Date(ms).toISOString()
  );
}

type SpaceViewStats = {
  total_views: number;
  total_likes: number;
  views7d: number;
  views30d: number;
  series: number[];
};

// Views summary + chart series, aggregated in SQL (`space_view_stats`) — for all
// of the user's spaces, or just `spaceId`.
async function fetchSpaceViewStats(
  userId: string,
  buckets: PeriodBucket[],
  spaceId: string | null
): Promise<SpaceViewStats | null> {
  const { data, error } = await createAdminClient().rpc("space_view_stats", {
    p_user_id: userId,
    p_bounds: bucketBounds(buckets),
    p_space_id: spaceId,
  });
  if (error) console.error("[space_view_stats]", error.message);
  return (data as SpaceViewStats | null) ?? null;
}

function toSeries(buckets: PeriodBucket[], counts: number[] | undefined): ViewsSeriesPoint[] {
  return buckets.map((b, i) => ({ label: b.label, views: Number(counts?.[i] ?? 0) }));
}

export async function getSpaceAnalytics(
  userId: string,
  spaceId: string,
  locale: string,
  period: StatsPeriod = "month"
): Promise<SpaceAnalytics> {
  const buckets = buildPeriodBuckets(period, locale);
  const stats = await fetchSpaceViewStats(userId, buckets, spaceId);

  return {
    spaceId,
    totalViews: Number(stats?.total_views ?? 0),
    views7d: Number(stats?.views7d ?? 0),
    views30d: Number(stats?.views30d ?? 0),
    viewsSeries: toSeries(buckets, stats?.series),
    likesCount: Number(stats?.total_likes ?? 0),
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
  // One page of the per-space table, most-viewed first.
  spaces: SpaceSummary[];
  page: number;
  totalPages: number;
};

export const CONTENT_ANALYTICS_PAGE_SIZE = 20;

export async function getDashboardAnalytics(
  userId: string,
  locale: string,
  period: StatsPeriod = "month",
  page = 1
): Promise<DashboardAnalytics> {
  const buckets = buildPeriodBuckets(period, locale);
  const safePage = Math.max(1, Math.floor(page) || 1);

  const [stats, { data: rows, error }] = await Promise.all([
    fetchSpaceViewStats(userId, buckets, null),
    createAdminClient().rpc("space_analytics_page", {
      p_user_id: userId,
      p_limit: CONTENT_ANALYTICS_PAGE_SIZE,
      p_offset: (safePage - 1) * CONTENT_ANALYTICS_PAGE_SIZE,
    }),
  ]);
  if (error) console.error("[space_analytics_page]", error.message);

  const pageRows = (rows ?? []) as (Omit<SpaceSummary, "views7d" | "views30d"> & {
    views7d: number;
    views30d: number;
    total_count: number;
  })[];
  const totalCount = Number(pageRows[0]?.total_count ?? 0);

  return {
    totalViews: Number(stats?.total_views ?? 0),
    totalLikes: Number(stats?.total_likes ?? 0),
    views7d: Number(stats?.views7d ?? 0),
    views30d: Number(stats?.views30d ?? 0),
    viewsSeries: toSeries(buckets, stats?.series),
    spaces: pageRows.map((r) => ({
      id: r.id,
      title: r.title,
      views_count: Number(r.views_count),
      likes_count: Number(r.likes_count),
      views7d: Number(r.views7d),
      views30d: Number(r.views30d),
    })),
    page: safePage,
    totalPages: Math.max(1, Math.ceil(totalCount / CONTENT_ANALYTICS_PAGE_SIZE)),
  };
}

export type ProfileVisitorAnalytics = {
  // Distinct visitors / visit-days across the whole selected period.
  uniqueVisitors: number;
  visits: number;
  // Distinct visitors per chart bucket.
  visitorsSeries: ViewsSeriesPoint[];
};

// Unique visitors to the owner's public profile page (profile_views),
// aggregated in SQL so large profiles don't hit the PostgREST row cap.
export async function getProfileVisitorAnalytics(
  profileId: string,
  locale: string,
  period: StatsPeriod = "month"
): Promise<ProfileVisitorAnalytics> {
  const buckets = buildPeriodBuckets(period, locale);
  const { data, error } = await createAdminClient().rpc("profile_visitor_stats", {
    p_profile_id: profileId,
    p_bounds: bucketBounds(buckets),
  });
  if (error) console.error("[getProfileVisitorAnalytics]", error.message);

  const rows = (data ?? []) as { bucket: number; visitors: number; visits: number }[];
  const byBucket = new Map(rows.map((r) => [r.bucket, r]));
  const total = byBucket.get(0);

  return {
    uniqueVisitors: Number(total?.visitors ?? 0),
    visits: Number(total?.visits ?? 0),
    visitorsSeries: buckets.map((b, i) => ({
      label: b.label,
      views: Number(byBucket.get(i + 1)?.visitors ?? 0),
    })),
  };
}
