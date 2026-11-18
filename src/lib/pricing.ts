import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionPlan } from "@/lib/types";

// Shared read of the public pricing catalog (active plans).
// Consumed by the pricing page's structured data, the homepage SoftwareApplication
// offers, and the machine-readable /pricing.md route so they never drift apart.
// Rarely-changing rows read on every homepage render — cache in-process with a
// short TTL, same approach as the plan catalog in `lib/plan.ts`.
type PublicPricing = { plans: SubscriptionPlan[] };
const PRICING_TTL_MS = 60_000;
let pricingCache: { at: number; pricing: PublicPricing } | null = null;

export async function getPublicPricing(): Promise<PublicPricing> {
  if (pricingCache && Date.now() - pricingCache.at < PRICING_TTL_MS) {
    return pricingCache.pricing;
  }
  try {
    const admin = createAdminClient();
    const { data: plans } = await admin
      .from("subscription_plans")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    const pricing: PublicPricing = { plans: (plans ?? []) as SubscriptionPlan[] };
    pricingCache = { at: Date.now(), pricing };
    return pricing;
  } catch {
    return { plans: [] };
  }
}
