// Pure business logic for the Stripe webhook. Kept separate from index.ts so
// it can be unit-tested without spinning up an HTTP server, Deno.env, or a
// real Supabase / Stripe client.
//
// Two payment shapes flow through here:
//   * credit-pack one-off purchases  → checkout.session.completed / charge.refunded
//   * site-wide plan subscriptions   → customer.subscription.* / invoice.paid
//
// Plan events map the subscription's Stripe price id → subscription_plans.slug
// (looked up in the DB) and then drive the profile's plan state via set_user_plan
// (+ refill_plan_credits when a billing period advances / an invoice is paid).
//
// NOTE: widget access is now gated by the site plan — the old per-instance widget
// subscription model is gone. Legacy per-instance subscriptions can still exist
// in Stripe and fire events; they carry an `instance_id` in their metadata, so we
// detect that marker and IGNORE them. Without this guard a legacy widget
// `subscription.deleted` would run the plan-downgrade path and wrongly knock the
// owner's site plan back to Free.

import type Stripe from "https://esm.sh/stripe@17?target=denonext";

// Minimal chainable query-builder shape. The real Supabase client returns a much
// richer builder; the handler only touches select().eq()…maybeSingle().
export interface QueryBuilder {
  select(cols: string): QueryBuilder;
  eq(col: string, val: unknown): QueryBuilder;
  update(values: Record<string, unknown>): UpdateBuilder;
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  maybeSingle(): Promise<{ data: any; error: unknown }>;
}

// A trimmed update chain: `.update({…}).eq(col, val)` resolves to { error }.
export interface UpdateBuilder {
  eq(col: string, val: unknown): Promise<{ error: unknown }>;
}

export interface AdminClientLike {
  rpc(name: string, args: Record<string, unknown>): Promise<{ error: unknown }>;
  from(table: string): QueryBuilder;
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
    case "customer.subscription.deleted": {
      // deno-lint-ignore no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = event.data.object as any;
      if (sub.metadata?.instance_id) {
        logger.info(`subscription=${sub.id} is a legacy per-instance widget sub — ignoring`);
        return { status: 200, body: { received: true, skipped: "legacy_widget" } };
      }
      return handlePlanSubscription(event, admin, logger);
    }
    case "invoice.paid": {
      // deno-lint-ignore no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inv = event.data.object as any;
      if (invoiceSubscriptionMetadata(inv).instance_id) {
        logger.info(`invoice=${inv.id} is a legacy per-instance widget invoice — ignoring`);
        return { status: 200, body: { received: true, skipped: "legacy_widget" } };
      }
      return handleInvoicePaid(event, admin, logger);
    }
    default:
      logger.info(`event.type=${event.type} not handled — acking`);
      return { status: 200, body: { received: true, ignored: event.type } };
  }
}

// ── Shared helpers ───────────────────────────────────────────────────────────

// Under the current Stripe API version the subscription metadata that used to
// live on `invoice.subscription_details` moved to `invoice.parent`. Read every
// known location so we work across API versions.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function invoiceSubscriptionMetadata(inv: any): Record<string, string> {
  return (
    inv.parent?.subscription_details?.metadata ??
    inv.subscription_details?.metadata ??
    inv.metadata ??
    {}
  );
}

// ── Plan lookups ─────────────────────────────────────────────────────────────

// Map a Stripe recurring price id → our plan slug. Returns null when the price
// isn't one of our known plans (e.g. a stale price, or a credit-pack price).
async function lookupPlanSlugByPrice(
  admin: AdminClientLike,
  priceId: string,
  logger: Logger,
): Promise<string | null> {
  const { data, error } = await admin
    .from("subscription_plans")
    .select("slug")
    .eq("stripe_price_id", priceId)
    .maybeSingle();
  if (error) {
    logger.error(`subscription_plans lookup failed for price=${priceId}`, error);
    return null;
  }
  return (data?.slug as string | undefined) ?? null;
}

// Resolve the profile that owns a subscription, when the event/metadata doesn't
// carry user_id directly. subscription.created stores plan_stripe_subscription_id
// via set_user_plan, so later invoices can find the user by it.
async function lookupUserBySubId(
  admin: AdminClientLike,
  subId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("plan_stripe_subscription_id", subId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

// ── customer.subscription.* → plan state ─────────────────────────────────────

async function handlePlanSubscription(
  event: Stripe.Event,
  admin: AdminClientLike,
  logger: Logger,
): Promise<HandlerResult> {
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = event.data.object as any;
  const subId: string = sub.id;
  const meta: Record<string, string> = sub.metadata ?? {};
  const periodEndUnix: number | null =
    sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;

  // Deletion always means "back to Free", regardless of the price we can read.
  if (event.type === "customer.subscription.deleted") {
    const userId = meta.user_id || (await lookupUserBySubId(admin, subId));
    if (!userId) {
      logger.warn(`subscription=${subId} deleted but no user resolvable — skipping`);
      return { status: 200, body: { received: true, skipped: "missing_user" } };
    }
    const { error } = await admin.rpc("set_user_plan", {
      p_user_id: userId,
      p_plan_slug: "free",
      p_status: "canceled",
      p_sub_id: subId,
      p_period_end: null,
    });
    if (error) {
      logger.error(`set_user_plan (downgrade) failed`, error);
      return { status: 500, body: { error: "plan_update_failed" } };
    }
    logger.info(`subscription ${subId} deleted → user=${userId} downgraded to free`);
    return { status: 200, body: { received: true, plan_slug: "free", plan_status: "canceled" } };
  }

  const priceId: string | null = sub.items?.data?.[0]?.price?.id ?? null;
  if (!priceId) {
    logger.warn(`subscription=${subId} has no price id — skipping`);
    return { status: 200, body: { received: true, skipped: "missing_price" } };
  }

  const slug = await lookupPlanSlugByPrice(admin, priceId, logger);
  if (!slug) {
    logger.warn(`subscription=${subId} price=${priceId} maps to no plan — skipping`);
    return { status: 200, body: { received: true, skipped: "unknown_price" } };
  }

  const userId = meta.user_id || (await lookupUserBySubId(admin, subId));
  if (!userId) {
    logger.warn(`subscription=${subId} has no user_id metadata and none stored — skipping`);
    return { status: 200, body: { received: true, skipped: "missing_user" } };
  }

  const status: string = sub.status;
  const { error } = await admin.rpc("set_user_plan", {
    p_user_id: userId,
    p_plan_slug: slug,
    p_status: status,
    p_sub_id: subId,
    p_period_end: periodEnd,
  });
  if (error) {
    logger.error(`set_user_plan failed`, error);
    return { status: 500, body: { error: "plan_update_failed" } };
  }

  // Burn the one-time trial the moment a subscription is seen trialing, so a
  // later cancel + resubscribe is charged immediately instead of trialing again.
  if (status === "trialing") {
    const { error: trialErr } = await admin
      .from("profiles")
      .update({ has_used_trial: true })
      .eq("id", userId);
    if (trialErr) {
      logger.warn(`marking has_used_trial failed for user=${userId}: ${JSON.stringify(trialErr)}`);
    }
  }

  logger.info(`plan sub ${subId} → user=${userId} slug=${slug} status=${status}`);
  return { status: 200, body: { received: true, plan_slug: slug, plan_status: status } };
}

// ── invoice.paid → refill the monthly allowance ──────────────────────────────

async function handleInvoicePaid(
  event: Stripe.Event,
  admin: AdminClientLike,
  logger: Logger,
): Promise<HandlerResult> {
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inv = event.data.object as any;
  const line = inv.lines?.data?.[0] ?? {};
  const priceId: string | null =
    line.price?.id ?? line.pricing?.price_details?.price ?? null;
  const subId: string | null =
    inv.subscription ?? line.subscription ?? inv.parent?.subscription_details?.subscription ?? null;

  if (!subId || !priceId) {
    logger.warn(`invoice=${inv.id} missing subscription/price — skipping (sub:${!!subId} price:${!!priceId})`);
    return { status: 200, body: { received: true, skipped: "missing_sub_or_price" } };
  }

  const slug = await lookupPlanSlugByPrice(admin, priceId, logger);
  if (!slug) {
    logger.warn(`invoice=${inv.id} price=${priceId} maps to no plan — skipping`);
    return { status: 200, body: { received: true, skipped: "unknown_price" } };
  }

  const userId: string | null =
    invoiceSubscriptionMetadata(inv).user_id ??
    (await lookupUserBySubId(admin, subId));
  if (!userId) {
    logger.warn(`invoice=${inv.id} sub=${subId} has no resolvable user — skipping`);
    return { status: 200, body: { received: true, skipped: "missing_user" } };
  }

  const periodEndUnix: number | null = line.period?.end ?? null;
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;

  // Keep plan state current (period end), then refill this period's allowance.
  const { error: planErr } = await admin.rpc("set_user_plan", {
    p_user_id: userId,
    p_plan_slug: slug,
    p_status: "active",
    p_sub_id: subId,
    p_period_end: periodEnd,
  });
  if (planErr) {
    logger.error(`set_user_plan (invoice) failed`, planErr);
    return { status: 500, body: { error: "plan_update_failed" } };
  }

  const { error: refillErr } = await admin.rpc("refill_plan_credits", {
    p_user_id: userId,
    p_plan_slug: slug,
  });
  if (refillErr) {
    logger.error(`refill_plan_credits failed`, refillErr);
    return { status: 500, body: { error: "refill_failed" } };
  }

  logger.info(`invoice ${inv.id} paid → user=${userId} slug=${slug} refilled`);
  return { status: 200, body: { received: true, refilled: slug } };
}

// ── checkout.session.completed → credit-pack grant ───────────────────────────

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

  // Plan-subscription checkouts also emit this event but carry no credit_pack_id;
  // they're handled via customer.subscription.* / invoice.paid, so skip here.
  if (!userId || !packId || !credits) {
    logger.warn(
      `session=${session.id} missing credit-pack metadata — skipping (userId:${!!userId} packId:${!!packId} credits:${credits})`,
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
  const creditsToClaw = Math.ceil((originalLedger.delta as number) * proportion);

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
