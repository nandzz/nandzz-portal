// Creates a Stripe Checkout Session (mode: subscription) so a user can
// subscribe to a paid plan (`starter` or `pro`), monthly or annual. The
// subscription carries { user_id, plan_slug } metadata so the webhook can map
// lifecycle events back to the profile's plan_* fields.
//
// A user who ALREADY has a live plan subscription (Starter ↔ Pro, or a cadence
// change) is never sent through a second Checkout — that would bill two
// subscriptions. Their existing subscription's price is swapped instead (see
// switchSubscription); the webhook maps the new price to the plan.
// Required env: STRIPE_SECRET_KEY, NEXT_PUBLIC_SITE_URL.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { checkoutLegalParams } from "@/lib/stripe/legal";

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
  const admin = createAdminClient();

  // Reuse / lazily create the Stripe customer, same as the credit-pack flow.
  // has_used_trial gates the one-time free trial so it can't be farmed by
  // cancelling and resubscribing.
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, has_used_trial, plan_stripe_subscription_id")
    .eq("id", user.id)
    .single();

  // Billing cadence — annual when explicitly "year", monthly otherwise.
  // "current" (plan switches from the subscription page) keeps the cadence of
  // the live subscription, so a yearly Pro moving to Starter stays yearly.
  const interval: "month" | "year" =
    rawInterval === "current"
      ? await currentInterval(profile?.plan_stripe_subscription_id ?? null)
      : rawInterval === "year"
        ? "year"
        : "month";

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

  try {
    const switched = await switchSubscription({
      subscriptionId: profile?.plan_stripe_subscription_id ?? null,
      customerId: profile?.stripe_customer_id ?? null,
      userId: user.id,
      planSlug: plan.slug,
      priceId,
      interval,
    });
    if (switched) return switched;
    return await createSession({ admin, user, plan, priceId, interval, profile });
  } catch (err) {
    // Stripe errors (stale customer from another account, bad price, ToS not
    // configured, …) would otherwise surface as an empty-body 500.
    const message = err instanceof Error ? err.message : String(err);
    console.error("[plan-checkout] failed:", err);
    return Response.json({ error: message }, { status: 500 });
  }
}

// Cadence of the user's existing plan subscription; monthly when there is none.
async function currentInterval(subscriptionId: string | null): Promise<"month" | "year"> {
  if (!subscriptionId) return "month";
  const sub = await getStripe().subscriptions.retrieve(subscriptionId).catch(() => null);
  return sub?.items.data[0]?.price.recurring?.interval === "year" ? "year" : "month";
}

// Subscription statuses that still hold a plan — switching one of these must
// update it in place rather than start a parallel subscription.
const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

// Swaps the price on the user's live plan subscription. Returns null when there
// is no live subscription (→ normal Checkout). Upgrades (higher amount) are
// invoiced immediately and only applied once paid (`pending_if_incomplete`), so
// a failed card can't unlock Pro; if the payment needs the customer (3DS, etc.)
// they are sent to Stripe's hosted invoice page. Downgrades apply now and the
// unused time is credited to the next invoice.
async function switchSubscription({
  subscriptionId,
  customerId,
  userId,
  planSlug,
  priceId,
  interval,
}: {
  subscriptionId: string | null;
  customerId: string | null;
  userId: string;
  planSlug: string;
  priceId: string;
  interval: "month" | "year";
}): Promise<Response | null> {
  if (!subscriptionId) return null;
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId).catch(() => null);
  if (!sub || !LIVE_STATUSES.has(sub.status)) return null;
  // A stale id from another customer/account must never be modified.
  const subCustomer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  if (customerId && subCustomer !== customerId) return null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const item = sub.items.data[0];
  if (!item) return null;
  if (item.price.id === priceId) {
    // Already on this exact plan + cadence: nothing to do.
    return Response.json({ url: `${siteUrl}/dashboard/subscription` });
  }

  const newPrice = await stripe.prices.retrieve(priceId);
  // Compare per-month amounts so a cadence change (monthly ↔ annual) is judged fairly.
  const monthly = (p: { unit_amount: number | null; recurring: { interval: string } | null }) =>
    (p.unit_amount ?? 0) / (p.recurring?.interval === "year" ? 12 : 1);
  const isUpgrade = monthly(newPrice) > monthly(item.price);

  const updated = isUpgrade
    ? await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: item.id, price: priceId }],
        proration_behavior: "always_invoice",
        payment_behavior: "pending_if_incomplete",
        expand: ["latest_invoice"],
      })
    : await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: item.id, price: priceId }],
        proration_behavior: "create_prorations",
        metadata: { user_id: userId, plan_slug: planSlug, interval },
      });

  if (isUpgrade) {
    // pending_if_incomplete doesn't accept metadata; refresh it once applied.
    if (!updated.pending_update) {
      await stripe.subscriptions
        .update(subscriptionId, { metadata: { user_id: userId, plan_slug: planSlug, interval } })
        .catch((err) => console.error("[plan-checkout] metadata refresh failed:", err));
    } else {
      const invoice = updated.latest_invoice;
      const hostedUrl = invoice && typeof invoice !== "string" ? invoice.hosted_invoice_url : null;
      if (hostedUrl) return Response.json({ url: hostedUrl });
    }
  }

  return Response.json({ url: `${siteUrl}/dashboard/subscription?switched=1` });
}

async function createSession({
  admin,
  user,
  plan,
  priceId,
  interval,
  profile,
}: {
  admin: ReturnType<typeof createAdminClient>;
  user: { id: string; email?: string };
  plan: { slug: string; trial_days: number | null };
  priceId: string;
  interval: "month" | "year";
  profile: { stripe_customer_id: string | null; has_used_trial: boolean | null } | null;
}) {
  const stripe = getStripe();
  let customerId = profile?.stripe_customer_id ?? null;
  if (customerId) {
    // A customer id minted under the old Stripe account (or deleted) 404s on
    // checkout — drop it and mint a fresh one in the current account.
    const existing = await stripe.customers.retrieve(customerId).catch(() => null);
    if (!existing || existing.deleted) customerId = null;
  }
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
    success_url: `${siteUrl}/dashboard/subscribed?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/dashboard/subscription?canceled=1`,
    allow_promotion_codes: true,
    ...(await checkoutLegalParams("subscription", siteUrl)),
    metadata,
    subscription_data: subscriptionData,
  });

  return Response.json({ url: session.url });
}
