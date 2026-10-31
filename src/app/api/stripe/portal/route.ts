// Stripe Customer Portal — lets users manage/cancel their plan subscription,
// update payment methods, and view invoice history.
// Must be activated in Stripe Dashboard → Settings → Billing → Customer portal.

import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

export async function POST() {
  if (!isStripeConfigured()) {
    return Response.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return Response.json({ error: "No purchase history yet" }, { status: 400 });
  }

  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${siteUrl}/dashboard/subscription`,
    });
    // Return the URL as JSON (client redirects). A fetch() can't follow a 303
    // to Stripe cross-origin, so the caller opens the portal itself.
    return Response.json({ url: portalSession.url });
  } catch (err) {
    // Most common cause: the Customer Portal hasn't been activated for this
    // account in Stripe Dashboard → Settings → Billing → Customer portal.
    // Surface a clean message instead of a 500 HTML page so the button can
    // show it inline.
    console.error("[stripe/portal] failed to create portal session:", err);
    return Response.json(
      { error: "Billing portal is unavailable right now. Please try again later." },
      { status: 502 },
    );
  }
}
