// Creates a one-off Stripe Checkout Session for a credit pack purchase.
// Required env: STRIPE_SECRET_KEY, NEXT_PUBLIC_SITE_URL.
// Each credit_pack row stores its own stripe_price_id — no env vars per pack.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return Response.json(
      {
        error: "Stripe is not configured yet.",
        instructions:
          "Set STRIPE_SECRET_KEY in .env.local. Pack price IDs live in the credit_packs table.",
      },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { credit_pack_id } = (await request.json()) as { credit_pack_id?: string };
  if (!credit_pack_id) {
    return Response.json({ error: "credit_pack_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: pack, error: packErr } = await admin
    .from("credit_packs")
    .select("id, name, credits, price_cents, currency, stripe_price_id, active")
    .eq("id", credit_pack_id)
    .single();

  if (packErr || !pack || !pack.active) {
    return Response.json({ error: "Pack not available" }, { status: 404 });
  }
  if (!pack.stripe_price_id) {
    return Response.json(
      { error: "Pack is missing a Stripe price. Sync it from the admin dashboard." },
      { status: 500 }
    );
  }

  // Look up or create the Stripe customer once per profile.
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
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
    await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: pack.stripe_price_id, quantity: 1 }],
    success_url: `${siteUrl}/dashboard/credits?success=1`,
    cancel_url: `${siteUrl}/dashboard/credits?canceled=1`,
    allow_promotion_codes: true,
    metadata: {
      user_id: user.id,
      credit_pack_id: pack.id,
      credits: String(pack.credits),
      pack_name: pack.name,
      pack_price_cents: String(pack.price_cents),
    },
  });

  return Response.json({ url: session.url });
}
