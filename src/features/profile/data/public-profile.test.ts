import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanEntitlements } from "@/lib/types";

const row = {
  id: "u1",
  username: "mario",
  background_color: "#4269c2",
  button_color: "#f59e0b",
  text_color: "#111827",
  booking_button_style: { color: "#10b981" },
  social_links_style: { shape: "pill" },
  header_layout: "hero",
  header_animated: true,
  gallery_caption_style: "gradient",
  background_url: "https://example.com/cover.jpg",
  plan_slug: "free",
  is_demo: false,
};

let selected: Record<string, unknown> = row;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: selected }) }),
      }),
    }),
  }),
}));

const entitlementsForSlug = vi.fn<(slug: string | null, isDemo?: boolean | null) => Promise<PlanEntitlements>>();
vi.mock("@/lib/plan", () => ({
  getEntitlementsForSlug: (slug: string | null, isDemo?: boolean | null) => entitlementsForSlug(slug, isDemo),
}));

const { fetchPublicProfile } = await import("./public-profile");

const base: PlanEntitlements = {
  spaceLimit: 25,
  hasWidgets: false,
  hasMcp: false,
  hasAnalytics: false,
  hasStyling: false,
  hideBranding: false,
  hasGoogleReview: false,
  monthlyCredits: 0,
};

describe("fetchPublicProfile plan gating", () => {
  beforeEach(() => {
    selected = row;
    entitlementsForSlug.mockReset();
  });

  it("renders a Free owner's stored style as the defaults and keeps the badge", async () => {
    entitlementsForSlug.mockResolvedValue(base);
    const p = (await fetchPublicProfile("mario")) as unknown as Record<string, unknown>;
    expect(p.background_color).toBeNull();
    expect(p.button_color).toBeNull();
    expect(p.text_color).toBeNull();
    expect(p.booking_button_style).toBeNull();
    expect(p.social_links_style).toBeNull();
    expect(p.header_layout).toBeNull();
    expect(p.header_animated).toBe(false);
    expect(p.gallery_caption_style).toBe("none");
    expect(p.background_url).toBe(row.background_url); // cover image stays free
    expect(p.hide_branding).toBe(false);
  });

  it("keeps a Starter owner's style and hides the badge", async () => {
    selected = { ...row, plan_slug: "starter" };
    entitlementsForSlug.mockResolvedValue({ ...base, hasStyling: true, hideBranding: true });
    const p = (await fetchPublicProfile("mario")) as unknown as Record<string, unknown>;
    expect(entitlementsForSlug).toHaveBeenCalledWith("starter", false);
    expect(p.background_color).toBe("#4269c2");
    expect(p.gallery_caption_style).toBe("gradient");
    expect(p.header_animated).toBe(true);
    expect(p.hide_branding).toBe(true);
  });

  it("never leaks plan_slug or is_demo to the client", async () => {
    entitlementsForSlug.mockResolvedValue(base);
    const p = (await fetchPublicProfile("mario")) as unknown as Record<string, unknown>;
    expect(p).not.toHaveProperty("plan_slug");
    expect(p).not.toHaveProperty("is_demo");
  });

  it("returns null for an unknown username", async () => {
    selected = null as unknown as Record<string, unknown>;
    expect(await fetchPublicProfile("nobody")).toBeNull();
    expect(entitlementsForSlug).not.toHaveBeenCalled();
  });
});
