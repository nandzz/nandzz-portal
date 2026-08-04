// Creates a Stripe Checkout Session (mode: subscription) so a profile owner can
// subscribe to a widget. Mirrors the credit-pack checkout, but recurring: the
// subscription carries { user_id, instance_id, catalog_id } metadata so the
// webhook can map lifecycle events back to the entitlement row.
// Required env: STRIPE_SECRET_KEY, NEXT_PUBLIC_SITE_URL.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { defaultCalendarConfig } from "@/lib/widgets/calendar";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return Response.json({ error: "Stripe is not configured yet." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { catalog_id } = (await request.json()) as { catalog_id?: string };
  if (!catalog_id) {
    return Response.json({ error: "catalog_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: widget, error: widgetErr } = await admin
    .from("widget_catalog")
    .select("id, slug, name, stripe_price_id, active")
    .eq("id", catalog_id)
    .single();

  if (widgetErr || !widget || !widget.active) {
    return Response.json({ error: "Widget not available" }, { status: 404 });
  }
  if (!widget.stripe_price_id) {
    return Response.json(
      { error: "Widget is missing a Stripe price. Sync it from the admin dashboard." },
      { status: 500 }
    );
  }

  // Ensure the (owner, widget-type) instance exists before checkout so its id
  // can ride along in the subscription metadata.
  const { data: existing } = await admin
    .from("widget_instances")
    .select("id")
    .eq("user_id", user.id)
    .eq("catalog_id", catalog_id)
    .maybeSingle();

  let instanceId = existing?.id as string | undefined;
  if (!instanceId) {
    const seedConfig = widget.slug === "calendar" ? defaultCalendarConfig() : {};
    const { data: created, error: createErr } = await admin
      .from("widget_instances")
      .insert({ user_id: user.id, catalog_id, config: seedConfig, enabled: false })
      .select("id")
      .single();
    if (createErr || !created) {
      return Response.json({ error: "Could not create widget instance" }, { status: 500 });
    }
    instanceId = created.id;
  }

  // Reuse / lazily create the Stripe customer, same as the credit-pack flow.
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
    await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  if (!instanceId) {
    return Response.json({ error: "Could not resolve widget instance" }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const metadata = { user_id: user.id, instance_id: instanceId, catalog_id };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: widget.stripe_price_id, quantity: 1 }],
    success_url: `${siteUrl}/dashboard/widgets/${instanceId}?subscribed=1`,
    cancel_url: `${siteUrl}/dashboard/widgets?canceled=1`,
    allow_promotion_codes: true,
    metadata,
    subscription_data: { metadata },
  });

  return Response.json({ url: session.url });
}
