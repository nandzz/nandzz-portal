export const dynamic = "force-dynamic";

// Stripe Checkout success_url for plan subscriptions. A dedicated route (rather
// than a query flag on /dashboard/subscription) so ad platforms can use
// "URL contains /dashboard/subscribed" as the purchase conversion.

import type Stripe from "stripe";
import { redirect } from "next/navigation";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { SubscriptionView, type WelcomeInfo } from "../subscription/SubscriptionView";

export default async function SubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);
  if (!userId) redirect("/login?redirect=/dashboard/subscription");

  const welcome = sessionId ? await verifyCheckout(sessionId, userId) : null;
  if (!welcome) redirect("/dashboard/subscription");

  return <SubscriptionView params={{}} welcome={welcome} />;
}

// Only a completed subscription checkout that belongs to this user counts —
// a reused or foreign session_id falls back to the plain subscription page.
async function verifyCheckout(sessionId: string, userId: string): Promise<WelcomeInfo | null> {
  if (!isStripeConfigured() || !sessionId.startsWith("cs_")) return null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
    if (session.mode !== "subscription" || session.status !== "complete") return null;
    if (session.metadata?.user_id !== userId || !session.metadata?.plan_slug) return null;
    const sub = session.subscription as Stripe.Subscription | null;
    const trialing = sub?.status === "trialing" && sub.trial_start && sub.trial_end;
    return {
      planSlug: session.metadata.plan_slug,
      trialDays: trialing ? Math.round((sub.trial_end! - sub.trial_start!) / 86400) : null,
      trialEnd: trialing ? new Date(sub.trial_end! * 1000).toISOString() : null,
    };
  } catch (err) {
    console.error("[subscribed] checkout verify failed:", err);
    return null;
  }
}
