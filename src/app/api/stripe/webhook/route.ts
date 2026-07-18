// Stripe webhook → credit grant.
// Only handles one-off pack purchases. Subscriptions are not used in the credits model.
//
// Required env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
// Configure in Stripe Dashboard → Developers → Webhooks → Add endpoint:
//   URL: https://your-domain.com/api/stripe/webhook
//   Events: checkout.session.completed, charge.refunded

import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !isStripeConfigured()) {
    return Response.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const packId = session.metadata?.credit_pack_id;
        const credits = Number(session.metadata?.credits ?? 0);
        const paymentIntentId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;

        if (!userId || !packId || !credits) {
          console.error("[stripe webhook] missing metadata on session", session.id);
          break;
        }

        // Idempotency: the grant_credits RPC short-circuits on a duplicate stripe_event_id.
        const { error: grantErr } = await admin.rpc("grant_credits", {
          p_user_id: userId,
          p_bucket: "paid",
          p_amount: credits,
          p_reason: "stripe_purchase",
          p_stripe_event_id: event.id,
          p_payment_intent_id: paymentIntentId,
          p_metadata: {
            credit_pack_id: packId,
            pack_name: session.metadata?.pack_name,
            pack_price_cents: Number(session.metadata?.pack_price_cents ?? 0),
            currency: session.currency,
            session_id: session.id,
          },
        });

        if (grantErr) {
          console.error("[stripe webhook] grant_credits failed:", grantErr);
          // Return 500 so Stripe retries.
          return Response.json({ error: "grant_failed" }, { status: 500 });
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;

        if (!paymentIntentId) break;

        // Locate the original grant to know how many credits to claw back.
        const { data: originalLedger } = await admin
          .from("credit_ledger")
          .select("user_id, delta")
          .eq("stripe_payment_intent_id", paymentIntentId)
          .eq("reason", "stripe_purchase")
          .maybeSingle();

        if (!originalLedger) {
          console.error("[stripe webhook] refund with no matching grant:", paymentIntentId);
          break;
        }

        const refundedAmount = charge.amount_refunded ?? 0;
        const proportion = charge.amount > 0 ? refundedAmount / charge.amount : 0;
        const creditsToClaw = Math.ceil(originalLedger.delta * proportion);

        if (creditsToClaw > 0) {
          const { error: refundErr } = await admin.rpc("grant_credits", {
            p_user_id: originalLedger.user_id,
            p_bucket: "paid",
            p_amount: -creditsToClaw,
            p_reason: "refund",
            p_stripe_event_id: event.id,
            p_payment_intent_id: paymentIntentId,
            p_metadata: {
              charge_id: charge.id,
              refunded_cents: refundedAmount,
            },
          });

          if (refundErr) {
            console.error("[stripe webhook] refund grant failed:", refundErr);
            return Response.json({ error: "refund_failed" }, { status: 500 });
          }
        }
        break;
      }

      default:
        // Other events are not relevant — Stripe still expects a 200.
        break;
    }
  } catch (err) {
    console.error("[stripe webhook] unhandled error:", err);
    return Response.json({ error: "internal" }, { status: 500 });
  }

  return Response.json({ received: true });
}
