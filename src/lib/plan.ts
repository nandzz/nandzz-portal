import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  PlanEntitlements,
  PlanSlug,
  SubscriptionPlan,
  UserPlan,
} from "@/lib/types";

// Hardcoded Free-plan fallback so gating stays correct even before the
// `subscription_plans` catalog is seeded, or when a profile points at a slug
// that has no matching (active) plan row. Mirrors the product spec:
// 25 spaces, no widgets, no MCP, no analytics, zero AI credits.
const FREE_FALLBACK: { name: string; entitlements: PlanEntitlements } = {
  name: "Free",
  entitlements: {
    spaceLimit: 25,
    hasWidgets: false,
    hasMcp: false,
    hasAnalytics: false,
    monthlyCredits: 0,
  },
};

function entitlementsFromPlan(plan: SubscriptionPlan): PlanEntitlements {
  return {
    spaceLimit: plan.space_limit,
    hasWidgets: plan.has_widgets,
    hasMcp: plan.has_mcp,
    hasAnalytics: plan.has_analytics,
    monthlyCredits: plan.monthly_credits,
  };
}

type ProfilePlanRow = {
  plan_slug: string | null;
  plan_status: string | null;
  plan_credits: number | null;
  paid_credits: number | null;
  plan_current_period_end: string | null;
  plan_cancel_at_period_end: boolean | null;
  comp_expires_at: string | null;
};

function resolve(
  profile: ProfilePlanRow | null,
  plan: SubscriptionPlan | null
): UserPlan {
  const slug = (profile?.plan_slug ?? "free") as PlanSlug;
  const entitlements = plan ? entitlementsFromPlan(plan) : FREE_FALLBACK.entitlements;
  const name = plan?.name ?? FREE_FALLBACK.name;
  return {
    slug,
    name,
    status: profile?.plan_status ?? null,
    planCredits: profile?.plan_credits ?? 0,
    paidCredits: profile?.paid_credits ?? 0,
    periodEnd: profile?.plan_current_period_end ?? null,
    cancelAtPeriodEnd: profile?.plan_cancel_at_period_end ?? false,
    compExpiresAt: profile?.comp_expires_at ?? null,
    entitlements,
  };
}

// The `subscription_plans` catalog is a handful of rarely-changing rows that is
// identical for every user, yet `getUserPlan` needs it on every gated request.
// Cache it in-process with a short TTL so the plan lookup is served from memory
// instead of adding a second sequential round-trip to Supabase per page load.
type AdminClient = ReturnType<typeof createAdminClient>;
const PLANS_TTL_MS = 60_000;
let plansCache: { at: number; bySlug: Map<string, SubscriptionPlan> } | null = null;

async function loadPlansBySlug(admin: AdminClient): Promise<Map<string, SubscriptionPlan>> {
  if (plansCache && Date.now() - plansCache.at < PLANS_TTL_MS) {
    return plansCache.bySlug;
  }
  const { data } = await admin.from("subscription_plans").select("*");
  const bySlug = new Map<string, SubscriptionPlan>();
  for (const plan of (data ?? []) as SubscriptionPlan[]) {
    bySlug.set(plan.slug, plan);
  }
  plansCache = { at: Date.now(), bySlug };
  return bySlug;
}

// Single source of truth for plan gating. Reads the profile's plan pointer and
// looks up the matching `subscription_plans` row. Uses the service-role client
// so it can resolve *any* user's plan (e.g. a profile owner from a public
// surface); callers decide who they're allowed to look up.
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const admin = createAdminClient();

  // The profile read and the (usually cached) catalog load are independent, so
  // run them concurrently instead of chaining slug → plan lookup.
  const [{ data: profile }, plansBySlug] = await Promise.all([
    admin
      .from("profiles")
      .select("plan_slug, plan_status, plan_credits, paid_credits, plan_current_period_end, plan_cancel_at_period_end, comp_expires_at")
      .eq("id", userId)
      .maybeSingle(),
    loadPlansBySlug(admin),
  ]);

  const slug = (profile?.plan_slug ?? "free") as PlanSlug;
  const plan = plansBySlug.get(slug) ?? null;

  return resolve((profile ?? null) as ProfilePlanRow | null, plan);
}

// Cheap helper when only the gating booleans are needed.
export async function getUserEntitlements(userId: string): Promise<PlanEntitlements> {
  const plan = await getUserPlan(userId);
  return plan.entitlements;
}

