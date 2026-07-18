// Stripe Customer Portal — lets users view receipts and manage payment methods.
// Subscriptions are not used in the credits model, but the portal still surfaces invoice history.
// Configure in Stripe Dashboard → Settings → Customer portal.

import { NextResponse } from "next/server";
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

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${siteUrl}/dashboard/credits`,
  });

  return NextResponse.redirect(portalSession.url, 303);
}
