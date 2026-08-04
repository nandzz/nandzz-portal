// Pure business logic for the Stripe webhook. Kept separate from index.ts so
// it can be unit-tested without spinning up an HTTP server, Deno.env, or a
// real Supabase / Stripe client.

import type Stripe from "https://esm.sh/stripe@17?target=denonext";

export interface AdminClientLike {
  rpc(name: string, args: Record<string, unknown>): Promise<{ error: unknown }>;
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: unknown): {
        eq(col: string, val: unknown): {
          maybeSingle(): Promise<{ data: LedgerRow | null; error: unknown }>;
        };
      };
    };
  };
}

export interface LedgerRow {
  user_id: string;
  delta: number;
}

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

export interface Logger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string, err?: unknown) => void;
}

const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

export async function handleStripeEvent(
  event: Stripe.Event,
  admin: AdminClientLike,
  logger: Logger = noopLogger,
): Promise<HandlerResult> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(event, admin, logger);
    case "charge.refunded":
      return handleChargeRefunded(event, admin, logger);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return handleWidgetSubscription(event, admin, logger);
    default:
      logger.info(`event.type=${event.type} not handled — acking`);
      return { status: 200, body: { received: true, ignored: event.type } };
  }
}

// Widget entitlement. Fires on every subscription lifecycle change. The
// subscription carries our metadata (set via `subscription_data.metadata` at
// checkout), so we can map it straight to the entitlement row. Status +
// current_period_end drive `has_widget_access`.
const WIDGET_SUB_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
]);

async function handleWidgetSubscription(
  event: Stripe.Event,
  admin: AdminClientLike,
  logger: Logger,
): Promise<HandlerResult> {
  const sub = event.data.object as Stripe.Subscription & {
    current_period_end?: number;
  };
  const meta = sub.metadata ?? {};
  const userId = meta.user_id || null;
  const instanceId = meta.instance_id || null;
  const catalogId = meta.catalog_id || null;

  if (!instanceId) {
    logger.warn(`subscription=${sub.id} has no instance_id metadata — skipping`);
    return { status: 200, body: { received: true, skipped: "missing_metadata" } };
  }

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

  // subscription.deleted always means the entitlement is gone.
  let status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
  if (!WIDGET_SUB_STATUSES.has(status)) status = "past_due"; // e.g. Stripe "paused"

  const periodEndUnix =
    sub.current_period_end ??
    (sub as unknown as { items?: { data?: Array<{ current_period_end?: number }> } })
      .items?.data?.[0]?.current_period_end ??
    null;
  const currentPeriodEnd = periodEndUnix
    ? new Date(periodEndUnix * 1000).toISOString()
    : null;

  const { error } = await admin.rpc("grant_widget_subscription", {
    p_user_id: userId,
    p_instance_id: instanceId,
    p_catalog_id: catalogId,
    p_stripe_subscription_id: sub.id,
    p_stripe_customer_id: customerId,
    p_status: status,
    p_current_period_end: currentPeriodEnd,
    p_stripe_event_id: event.id,
    p_event_created: new Date(event.created * 1000).toISOString(),
  });

  if (error) {
    logger.error(`grant_widget_subscription failed`, error);
    return { status: 500, body: { error: "widget_sub_failed" } };
  }

  logger.info(`widget sub ${sub.id} → status=${status} instance=${instanceId}`);
  return { status: 200, body: { received: true, widget_status: status } };
}

async function handleCheckoutCompleted(
  event: Stripe.Event,
  admin: AdminClientLike,
  logger: Logger,
): Promise<HandlerResult> {
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.user_id;
  const packId = session.metadata?.credit_pack_id;
  const credits = Number(session.metadata?.credits ?? 0);
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  if (!userId || !packId || !credits) {
    logger.warn(
      `session=${session.id} missing metadata — skipping (userId:${!!userId} packId:${!!packId} credits:${credits})`,
    );
    return { status: 200, body: { received: true, skipped: "missing_metadata" } };
  }

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
    logger.error(`grant_credits failed`, grantErr);
    return { status: 500, body: { error: "grant_failed" } };
  }

  logger.info(`granted ${credits} credits to user=${userId}`);
  return { status: 200, body: { received: true, granted: credits } };
}

async function handleChargeRefunded(
  event: Stripe.Event,
  admin: AdminClientLike,
  logger: Logger,
): Promise<HandlerResult> {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!paymentIntentId) {
    logger.warn(`charge=${charge.id} has no payment_intent — skipping`);
    return { status: 200, body: { received: true, skipped: "no_payment_intent" } };
  }

  const { data: originalLedger, error: lookupErr } = await admin
    .from("credit_ledger")
    .select("user_id, delta")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("reason", "stripe_purchase")
    .maybeSingle();

  if (lookupErr) {
    logger.error(`credit_ledger lookup failed for pi=${paymentIntentId}`, lookupErr);
    return { status: 500, body: { error: "lookup_failed" } };
  }

  if (!originalLedger) {
    logger.warn(
      `refund for pi=${paymentIntentId} has no matching grant — acking without clawback`,
    );
    return { status: 200, body: { received: true, skipped: "no_matching_grant" } };
  }

  const refundedAmount = charge.amount_refunded ?? 0;
  const proportion = charge.amount > 0 ? refundedAmount / charge.amount : 0;
  const creditsToClaw = Math.ceil(originalLedger.delta * proportion);

  if (creditsToClaw <= 0) {
    logger.info(`nothing to claw back (claw=${creditsToClaw})`);
    return { status: 200, body: { received: true, clawed: 0 } };
  }

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
    logger.error(`refund grant failed`, refundErr);
    return { status: 500, body: { error: "refund_failed" } };
  }

  logger.info(`clawed back ${creditsToClaw} credits from user=${originalLedger.user_id}`);
  return { status: 200, body: { received: true, clawed: creditsToClaw } };
}
