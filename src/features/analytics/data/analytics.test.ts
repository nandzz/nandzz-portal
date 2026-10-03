import { describe, it, expect, vi, beforeEach } from "vitest";

// Fixtures the mocked admin client's rpc() resolves against, keyed by function.
let rpcResults: Record<string, { data: unknown; error: { message: string } | null }>;
let rpcCalls: { fn: string; args: Record<string, unknown> }[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return rpcResults[fn] ?? { data: null, error: null };
    },
  }),
}));

import {
  getSpaceAnalytics,
  getDashboardAnalytics,
  getProfileVisitorAnalytics,
  CONTENT_ANALYTICS_PAGE_SIZE,
} from "./analytics";

const stats = { total_views: 15, total_likes: 5, views7d: 2, views30d: 3, series: [0, 1, 0, 0, 2] };

beforeEach(() => {
  rpcCalls = [];
  rpcResults = {
    space_view_stats: { data: stats, error: null },
    space_analytics_page: {
      data: [
        { id: "s1", title: "One", views_count: 10, likes_count: 2, views7d: 2, views30d: 2, total_count: 45 },
        { id: "s2", title: "Two", views_count: 5, likes_count: 3, views7d: 0, views30d: 1, total_count: 45 },
      ],
      error: null,
    },
    profile_visitor_stats: {
      data: [
        { bucket: 0, visitors: 7, visits: 9 },
        { bucket: 2, visitors: 4, visits: 5 },
      ],
      error: null,
    },
  };
});

describe("getSpaceAnalytics", () => {
  it("maps the SQL stats for one space, scoped to the owner", async () => {
    const res = await getSpaceAnalytics("u1", "s1", "en", "month");
    expect(rpcCalls[0]).toMatchObject({ fn: "space_view_stats", args: { p_user_id: "u1", p_space_id: "s1" } });
    expect(res).toMatchObject({ spaceId: "s1", totalViews: 15, likesCount: 5, views7d: 2, views30d: 3 });
    expect(res.viewsSeries.map((p) => p.views)).toEqual([0, 1, 0, 0, 2]);
  });

  it("returns zeros when the RPC fails", async () => {
    rpcResults.space_view_stats = { data: null, error: { message: "boom" } };
    const res = await getSpaceAnalytics("u1", "s1", "en", "week");
    expect(res.totalViews).toBe(0);
    expect(res.viewsSeries).toHaveLength(7);
    expect(res.viewsSeries.every((p) => p.views === 0)).toBe(true);
  });
});

describe("getDashboardAnalytics", () => {
  it("combines totals with one page of spaces", async () => {
    const res = await getDashboardAnalytics("u1", "en", "month", 2);
    expect(res).toMatchObject({ totalViews: 15, totalLikes: 5, views7d: 2, views30d: 3, page: 2, totalPages: 3 });
    expect(res.spaces.map((s) => s.id)).toEqual(["s1", "s2"]);
    const pageCall = rpcCalls.find((c) => c.fn === "space_analytics_page")!;
    expect(pageCall.args).toEqual({
      p_user_id: "u1",
      p_limit: CONTENT_ANALYTICS_PAGE_SIZE,
      p_offset: CONTENT_ANALYTICS_PAGE_SIZE,
    });
  });

  it("returns an empty single page when the user has no spaces", async () => {
    rpcResults.space_analytics_page = { data: [], error: null };
    const res = await getDashboardAnalytics("u1", "en", "month", 0);
    expect(res.spaces).toEqual([]);
    expect(res.page).toBe(1);
    expect(res.totalPages).toBe(1);
  });
});

describe("getProfileVisitorAnalytics", () => {
  it("uses bucket 0 as the period total and fills missing buckets with 0", async () => {
    const res = await getProfileVisitorAnalytics("u1", "en", "month");
    expect(res.uniqueVisitors).toBe(7);
    expect(res.visits).toBe(9);
    expect(res.visitorsSeries.map((p) => p.views)).toEqual([0, 4, 0, 0, 0]);
  });
});
