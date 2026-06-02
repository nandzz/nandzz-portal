import { createAdminClient } from "@/lib/supabase/admin";
import type { DailyViews, SpaceAnalytics } from "@/lib/types";

function buildDailyBuckets(days: number): Record<string, number> {
  const buckets: Record<string, number> = {};
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets[d.toISOString().split("T")[0]] = 0;
  }
  return buckets;
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function getSpaceAnalytics(spaceId: string): Promise<SpaceAnalytics> {
  const admin = createAdminClient();

  const [{ data: space }, { data: views30d }, { count: total }] = await Promise.all([
    admin.from("spaces").select("likes_count, views_count").eq("id", spaceId).single(),
    admin
      .from("space_views")
      .select("viewed_at")
      .eq("space_id", spaceId)
      .gte("viewed_at", daysAgoISO(30)),
    admin
      .from("space_views")
      .select("*", { count: "exact", head: true })
      .eq("space_id", spaceId),
  ]);

  const cutoff7d = new Date(daysAgoISO(7));
  const views7d = (views30d ?? []).filter((v) => new Date(v.viewed_at) >= cutoff7d).length;

  const buckets = buildDailyBuckets(30);
  for (const view of views30d ?? []) {
    const date = view.viewed_at.split("T")[0];
    if (date in buckets) buckets[date]++;
  }
  const dailyViews: DailyViews[] = Object.entries(buckets).map(([date, views]) => ({
    date,
    views,
  }));

  return {
    spaceId,
    totalViews: total ?? space?.views_count ?? 0,
    views7d,
    views30d: views30d?.length ?? 0,
    dailyViews,
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
  dailyViews: DailyViews[];
  spaces: SpaceSummary[];
};

export async function getDashboardAnalytics(userId: string): Promise<DashboardAnalytics> {
  const admin = createAdminClient();

  const { data: spaces } = await admin
    .from("spaces")
    .select("id, title, views_count, likes_count")
    .eq("user_id", userId);

  if (!spaces || spaces.length === 0) {
    const buckets = buildDailyBuckets(30);
    return {
      totalViews: 0,
      totalLikes: 0,
      views7d: 0,
      views30d: 0,
      dailyViews: Object.entries(buckets).map(([date, views]) => ({ date, views })),
      spaces: [],
    };
  }

  const spaceIds = spaces.map((s) => s.id);
  const { data: recentViews } = await admin
    .from("space_views")
    .select("space_id, viewed_at")
    .in("space_id", spaceIds)
    .gte("viewed_at", daysAgoISO(30));

  const cutoff7d = new Date(daysAgoISO(7));

  // Per-space 30d/7d counters
  const viewsMap: Record<string, { views30d: number; views7d: number }> = {};
  for (const s of spaces) viewsMap[s.id] = { views30d: 0, views7d: 0 };

  const buckets = buildDailyBuckets(30);
  for (const v of recentViews ?? []) {
    const date = v.viewed_at.split("T")[0];
    if (date in buckets) buckets[date]++;
    viewsMap[v.space_id].views30d++;
    if (new Date(v.viewed_at) >= cutoff7d) viewsMap[v.space_id].views7d++;
  }

  const totalViews = spaces.reduce((sum, s) => sum + (s.views_count ?? 0), 0);
  const totalLikes = spaces.reduce((sum, s) => sum + (s.likes_count ?? 0), 0);
  const views30d = (recentViews ?? []).length;
  const views7d = (recentViews ?? []).filter((v) => new Date(v.viewed_at) >= cutoff7d).length;

  return {
    totalViews,
    totalLikes,
    views7d,
    views30d,
    dailyViews: Object.entries(buckets).map(([date, views]) => ({ date, views })),
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
