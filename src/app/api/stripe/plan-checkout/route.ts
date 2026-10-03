// Creates a Stripe Checkout Session (mode: subscription) so a user can
// subscribe to the single paid plan (slug `pro`), monthly or annual. The
// subscription carries { user_id, plan_slug } metadata so the webhook can map
// lifecycle events back to the profile's plan_* fields.
// Required env: STRIPE_SECRET_KEY, NEXT_PUBLIC_SITE_URL.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return Response.json({ error: "Stripe is not configured yet." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { plan_slug, interval: rawInterval } = (await request.json()) as {
    plan_slug?: string;
    interval?: string;
  };
  if (!plan_slug) {
    return Response.json({ error: "plan_slug is required" }, { status: 400 });
  }
  if (plan_slug === "free") {
    return Response.json({ error: "The Free plan does not require checkout." }, { status: 400 });
  }
  // Billing cadence — annual when explicitly "year", monthly otherwise.
  const interval: "month" | "year" = rawInterval === "year" ? "year" : "month";

  const admin = createAdminClient();

  const { data: plan, error: planErr } = await admin
    .from("subscription_plans")
    .select("slug, name, stripe_price_id, stripe_annual_price_id, active, price_cents, trial_days")
    .eq("slug", plan_slug)
    .single();

  if (planErr || !plan || !plan.active) {
    return Response.json({ error: "Plan not available" }, { status: 404 });
  }

  // Pick the Stripe Price for the chosen cadence. Both are populated by the
  // admin "Sync to Stripe"; annual is unavailable until it's been synced.
  const priceId = interval === "year" ? plan.stripe_annual_price_id : plan.stripe_price_id;
  if (!priceId) {
    return Response.json(
      {
        error:
          interval === "year"
            ? "Annual billing isn't available yet. Sync the annual price from the admin dashboard."
            : "Plan is missing a Stripe price. Sync it from the admin dashboard.",
      },
      { status: 500 }
    );
  }

  // Reuse / lazily create the Stripe customer, same as the credit-pack flow.
  // has_used_trial gates the one-time free trial so it can't be farmed by
  // cancelling and resubscribing.
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, has_used_trial")
    .eq("id", user.id)
    .single();

  const stripe = getStripe();
  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const metadata = { user_id: user.id, plan_slug: plan.slug, interval };

  // A free trial (trial_days > 0) delays the first charge; the subscription
  // starts in `trialing` and the webhook maps that to plan_status the same way.
  // Only the FIRST subscription gets the trial — once a user has trialed (or
  // ever reached Stripe, per the backfill) has_used_trial stays true, so a
  // resubscribe is charged immediately.
  const trialDays = plan.trial_days ?? 0;
  const grantTrial = trialDays > 0 && !profile?.has_used_trial;
  const subscriptionData =
    grantTrial ? { metadata, trial_period_days: trialDays } : { metadata };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/dashboard/credits?subscribed=1`,
    cancel_url: `${siteUrl}/dashboard/credits?canceled=1`,
    allow_promotion_codes: true,
    metadata,
    subscription_data: subscriptionData,
  });

  return Response.json({ url: session.url });
}
