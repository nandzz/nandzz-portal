// Pure business logic for the Stripe webhook. Kept separate from index.ts so
// it can be unit-tested without spinning up an HTTP server, Deno.env, or a
// real Supabase / Stripe client.
//
// Site-wide plan subscriptions flow through here (customer.subscription.* /
// invoice.paid). Plan events map the subscription's Stripe price id →
// subscription_plans.slug (looked up in the DB) and then drive the profile's
// plan state via set_user_plan. Any other event is acknowledged and ignored.
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
  or(filter: string): QueryBuilder;
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

// Map a Stripe recurring price id → our plan slug. A plan can have two Prices —
// monthly (stripe_price_id) and annual (stripe_annual_price_id) — so we match
// either. Returns null when the price isn't one of our known plans (e.g. a stale
// price).
async function lookupPlanSlugByPrice(
  admin: AdminClientLike,
  priceId: string,
  logger: Logger,
): Promise<string | null> {
  const { data, error } = await admin
    .from("subscription_plans")
    .select("slug")
    .or(`stripe_price_id.eq.${priceId},stripe_annual_price_id.eq.${priceId}`)
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
  // Stripe keeps status "active" when a user cancels in the portal; the signal
  // that the plan is winding down is EITHER the legacy `cancel_at_period_end`
  // boolean OR (on current API versions, which is what the portal now emits) a
  // future `cancel_at` timestamp. Treat either as "canceling" so the UI can say
  // "active until <date>" + offer reactivation instead of "renews".
  const cancelAtUnix: number | null =
    typeof sub.cancel_at === "number" ? sub.cancel_at : null;
  const cancelAtPeriodEnd: boolean = sub.cancel_at_period_end === true || cancelAtUnix !== null;
  // The moment paid access actually ends: the scheduled cancel time when
  // canceling (it may differ from the billing period end), else the renewal.
  const accessEndUnix = cancelAtPeriodEnd ? (cancelAtUnix ?? periodEndUnix) : periodEndUnix;
  const periodEnd = accessEndUnix ? new Date(accessEndUnix * 1000).toISOString() : null;

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
      p_cancel_at_period_end: false,
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
    p_cancel_at_period_end: cancelAtPeriodEnd,
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

// ── invoice.paid → keep the period end current ──────────────────────────────

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

  // Keep plan state current (period end).
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

  logger.info(`invoice ${inv.id} paid → user=${userId} slug=${slug}`);
  return { status: 200, body: { received: true, plan: slug } };
}
