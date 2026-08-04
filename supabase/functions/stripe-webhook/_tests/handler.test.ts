import {
  assertEquals,
  assertObjectMatch,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import type Stripe from "https://esm.sh/stripe@17?target=denonext";
import {
  handleStripeEvent,
  type AdminClientLike,
  type LedgerRow,
} from "../handler.ts";

// ---- Fake admin client ------------------------------------------------------
// Records every RPC / query call so tests can assert on them.

interface RpcCall {
  name: string;
  args: Record<string, unknown>;
}

interface FakeAdminOptions {
  rpcError?: unknown;
  lookupResult?: { data: LedgerRow | null; error: unknown };
}

function makeAdmin(opts: FakeAdminOptions = {}): {
  admin: AdminClientLike;
  rpcCalls: RpcCall[];
  lookupCalls: Array<{ table: string; filters: Array<[string, unknown]> }>;
} {
  const rpcCalls: RpcCall[] = [];
  const lookupCalls: Array<{ table: string; filters: Array<[string, unknown]> }> =
    [];

  const admin: AdminClientLike = {
    rpc: (name, args) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({ error: opts.rpcError ?? null });
    },
    from: (table) => {
      const filters: Array<[string, unknown]> = [];
      const chain = {
        select: (_cols: string) => chain,
        eq: (col: string, val: unknown) => {
          filters.push([col, val]);
          return chain;
        },
        maybeSingle: () => {
          lookupCalls.push({ table, filters: [...filters] });
          return Promise.resolve(
            opts.lookupResult ?? { data: null, error: null },
          );
        },
      };
      return chain as ReturnType<AdminClientLike["from"]>;
    },
  };

  return { admin, rpcCalls, lookupCalls };
}

// ---- Event factories --------------------------------------------------------

function checkoutEvent(overrides: {
  metadata?: Record<string, string> | null;
  paymentIntent?: string | { id: string } | null;
  sessionId?: string;
  currency?: string;
  eventId?: string;
}): Stripe.Event {
  const paymentIntent =
    "paymentIntent" in overrides ? overrides.paymentIntent : "pi_test_123";
  return {
    id: overrides.eventId ?? "evt_test_checkout",
    type: "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        id: overrides.sessionId ?? "cs_test_123",
        payment_intent: paymentIntent,
        currency: overrides.currency ?? "usd",
        metadata:
          overrides.metadata === undefined
            ? {
                user_id: "user-1",
                credit_pack_id: "pack-1",
                credits: "500",
                pack_name: "Starter",
                pack_price_cents: "500",
              }
            : overrides.metadata ?? {},
      } as unknown as Stripe.Checkout.Session,
    },
  } as unknown as Stripe.Event;
}

function refundEvent(overrides: {
  paymentIntent?: string | { id: string } | null;
  amount?: number;
  amountRefunded?: number;
  chargeId?: string;
  eventId?: string;
}): Stripe.Event {
  const paymentIntent =
    "paymentIntent" in overrides ? overrides.paymentIntent : "pi_test_123";
  return {
    id: overrides.eventId ?? "evt_test_refund",
    type: "charge.refunded",
    livemode: false,
    data: {
      object: {
        id: overrides.chargeId ?? "ch_test_123",
        payment_intent: paymentIntent,
        amount: overrides.amount ?? 1500,
        amount_refunded: overrides.amountRefunded ?? 1500,
      } as unknown as Stripe.Charge,
    },
  } as unknown as Stripe.Event;
}

// ---- checkout.session.completed --------------------------------------------

Deno.test("checkout: grants credits and calls grant_credits with the expected payload", async () => {
  const { admin, rpcCalls } = makeAdmin();
  const result = await handleStripeEvent(checkoutEvent({}), admin);

  assertEquals(result.status, 200);
  assertEquals(result.body.received, true);
  assertEquals(result.body.granted, 500);

  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].name, "grant_credits");
  assertObjectMatch(rpcCalls[0].args, {
    p_user_id: "user-1",
    p_bucket: "paid",
    p_amount: 500,
    p_reason: "stripe_purchase",
    p_stripe_event_id: "evt_test_checkout",
    p_payment_intent_id: "pi_test_123",
  });
});

Deno.test("checkout: skips with 200 when metadata is missing", async () => {
  const { admin, rpcCalls } = makeAdmin();
  const result = await handleStripeEvent(
    checkoutEvent({ metadata: {} }),
    admin,
  );

  assertEquals(result.status, 200);
  assertEquals(result.body.skipped, "missing_metadata");
  assertEquals(rpcCalls.length, 0, "no RPC should fire without metadata");
});

Deno.test("checkout: skips when credits=0", async () => {
  const { admin, rpcCalls } = makeAdmin();
  const result = await handleStripeEvent(
    checkoutEvent({
      metadata: { user_id: "u", credit_pack_id: "p", credits: "0" },
    }),
    admin,
  );

  assertEquals(result.status, 200);
  assertEquals(result.body.skipped, "missing_metadata");
  assertEquals(rpcCalls.length, 0);
});

Deno.test("checkout: returns 500 when grant_credits errors so Stripe retries", async () => {
  const { admin, rpcCalls } = makeAdmin({ rpcError: { message: "db_down" } });
  const result = await handleStripeEvent(checkoutEvent({}), admin);

  assertEquals(result.status, 500);
  assertEquals(result.body.error, "grant_failed");
  assertEquals(rpcCalls.length, 1);
});

Deno.test("checkout: unwraps payment_intent when passed as an expanded object", async () => {
  const { admin, rpcCalls } = makeAdmin();
  await handleStripeEvent(
    checkoutEvent({ paymentIntent: { id: "pi_expanded" } }),
    admin,
  );

  assertEquals(rpcCalls[0].args.p_payment_intent_id, "pi_expanded");
});

Deno.test("checkout: tolerates missing payment_intent (null)", async () => {
  const { admin, rpcCalls } = makeAdmin();
  await handleStripeEvent(
    checkoutEvent({ paymentIntent: null }),
    admin,
  );

  assertEquals(rpcCalls[0].args.p_payment_intent_id, null);
});

// ---- charge.refunded --------------------------------------------------------

Deno.test("refund: skips with 200 when payment_intent is missing", async () => {
  const { admin, rpcCalls, lookupCalls } = makeAdmin();
  const result = await handleStripeEvent(
    refundEvent({ paymentIntent: null }),
    admin,
  );

  assertEquals(result.status, 200);
  assertEquals(result.body.skipped, "no_payment_intent");
  assertEquals(rpcCalls.length, 0);
  assertEquals(lookupCalls.length, 0);
});

Deno.test("refund: acks with 200 when no matching grant is found", async () => {
  const { admin, rpcCalls, lookupCalls } = makeAdmin({
    lookupResult: { data: null, error: null },
  });
  const result = await handleStripeEvent(refundEvent({}), admin);

  assertEquals(result.status, 200);
  assertEquals(result.body.skipped, "no_matching_grant");
  assertEquals(lookupCalls.length, 1);
  assertEquals(lookupCalls[0].table, "credit_ledger");
  assertEquals(lookupCalls[0].filters, [
    ["stripe_payment_intent_id", "pi_test_123"],
    ["reason", "stripe_purchase"],
  ]);
  assertEquals(rpcCalls.length, 0);
});

Deno.test("refund: returns 500 when the credit_ledger lookup errors", async () => {
  const { admin, rpcCalls } = makeAdmin({
    lookupResult: { data: null, error: { message: "db_down" } },
  });
  const result = await handleStripeEvent(refundEvent({}), admin);

  assertEquals(result.status, 500);
  assertEquals(result.body.error, "lookup_failed");
  assertEquals(rpcCalls.length, 0);
});

Deno.test("refund: full refund claws back the full grant", async () => {
  const { admin, rpcCalls } = makeAdmin({
    lookupResult: { data: { user_id: "user-1", delta: 500 }, error: null },
  });
  const result = await handleStripeEvent(
    refundEvent({ amount: 1500, amountRefunded: 1500 }),
    admin,
  );

  assertEquals(result.status, 200);
  assertEquals(result.body.clawed, 500);
  assertEquals(rpcCalls.length, 1);
  assertObjectMatch(rpcCalls[0].args, {
    p_user_id: "user-1",
    p_bucket: "paid",
    p_amount: -500,
    p_reason: "refund",
    p_stripe_event_id: "evt_test_refund",
    p_payment_intent_id: "pi_test_123",
  });
});

Deno.test("refund: partial refund claws back proportionally, rounded up", async () => {
  // Original grant 500 credits for a $15 charge. Refund $7.50 → 50% → 250 credits.
  const { admin, rpcCalls } = makeAdmin({
    lookupResult: { data: { user_id: "user-1", delta: 500 }, error: null },
  });
  const result = await handleStripeEvent(
    refundEvent({ amount: 1500, amountRefunded: 750 }),
    admin,
  );

  assertEquals(result.status, 200);
  assertEquals(result.body.clawed, 250);
  assertEquals(rpcCalls[0].args.p_amount, -250);
});

Deno.test("refund: rounds up so we never under-clawback on odd proportions", async () => {
  // 501 credits, refund 1/3 → 167 credits (166.67 rounded up)
  const { admin, rpcCalls } = makeAdmin({
    lookupResult: { data: { user_id: "user-1", delta: 501 }, error: null },
  });
  const result = await handleStripeEvent(
    refundEvent({ amount: 3000, amountRefunded: 1000 }),
    admin,
  );

  assertEquals(result.body.clawed, 167);
  assertEquals(rpcCalls[0].args.p_amount, -167);
});

Deno.test("refund: zero-amount refund is a no-op ack", async () => {
  const { admin, rpcCalls } = makeAdmin({
    lookupResult: { data: { user_id: "user-1", delta: 500 }, error: null },
  });
  const result = await handleStripeEvent(
    refundEvent({ amount: 1500, amountRefunded: 0 }),
    admin,
  );

  assertEquals(result.status, 200);
  assertEquals(result.body.clawed, 0);
  assertEquals(rpcCalls.length, 0);
});

Deno.test("refund: returns 500 when the clawback RPC errors so Stripe retries", async () => {
  const { admin } = makeAdmin({
    lookupResult: { data: { user_id: "user-1", delta: 500 }, error: null },
    rpcError: { message: "db_down" },
  });
  const result = await handleStripeEvent(refundEvent({}), admin);

  assertEquals(result.status, 500);
  assertEquals(result.body.error, "refund_failed");
});

Deno.test("refund: unwraps payment_intent when passed as an expanded object", async () => {
  const { admin, lookupCalls } = makeAdmin({
    lookupResult: { data: null, error: null },
  });
  await handleStripeEvent(
    refundEvent({ paymentIntent: { id: "pi_expanded" } }),
    admin,
  );

  assertEquals(lookupCalls[0].filters[0], [
    "stripe_payment_intent_id",
    "pi_expanded",
  ]);
});

// ---- customer.subscription.* (widget entitlements) --------------------------

function subscriptionEvent(overrides: {
  type?: string;
  metadata?: Record<string, string> | null;
  status?: string;
  customer?: string | { id: string } | null;
  currentPeriodEnd?: number | null;
  subId?: string;
  eventId?: string;
  eventCreated?: number;
}): Stripe.Event {
  return {
    id: overrides.eventId ?? "evt_test_sub",
    type: overrides.type ?? "customer.subscription.created",
    livemode: false,
    created: overrides.eventCreated ?? 1_700_000_000,
    data: {
      object: {
        id: overrides.subId ?? "sub_test_123",
        status: overrides.status ?? "active",
        customer: "customer" in overrides ? overrides.customer : "cus_test_1",
        current_period_end:
          "currentPeriodEnd" in overrides ? overrides.currentPeriodEnd : 1_700_100_000,
        metadata:
          overrides.metadata === undefined
            ? { user_id: "user-1", instance_id: "inst-1", catalog_id: "cat-1" }
            : overrides.metadata ?? {},
      } as unknown as Stripe.Subscription,
    },
  } as unknown as Stripe.Event;
}

Deno.test("subscription.created: calls grant_widget_subscription with mapped fields", async () => {
  const { admin, rpcCalls } = makeAdmin();
  const result = await handleStripeEvent(subscriptionEvent({}), admin);

  assertEquals(result.status, 200);
  assertEquals(result.body.widget_status, "active");
  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].name, "grant_widget_subscription");
  assertObjectMatch(rpcCalls[0].args, {
    p_user_id: "user-1",
    p_instance_id: "inst-1",
    p_catalog_id: "cat-1",
    p_stripe_subscription_id: "sub_test_123",
    p_stripe_customer_id: "cus_test_1",
    p_status: "active",
    p_stripe_event_id: "evt_test_sub",
  });
  assertEquals(
    rpcCalls[0].args.p_current_period_end,
    new Date(1_700_100_000 * 1000).toISOString(),
  );
});

Deno.test("subscription.deleted: forces status=canceled regardless of object status", async () => {
  const { admin, rpcCalls } = makeAdmin();
  await handleStripeEvent(
    subscriptionEvent({ type: "customer.subscription.deleted", status: "active" }),
    admin,
  );
  assertEquals(rpcCalls[0].args.p_status, "canceled");
});

Deno.test("subscription: unknown Stripe status (paused) coerces to past_due", async () => {
  const { admin, rpcCalls } = makeAdmin();
  await handleStripeEvent(subscriptionEvent({ status: "paused" }), admin);
  assertEquals(rpcCalls[0].args.p_status, "past_due");
});

Deno.test("subscription: skips with 200 when instance_id metadata is missing", async () => {
  const { admin, rpcCalls } = makeAdmin();
  const result = await handleStripeEvent(subscriptionEvent({ metadata: {} }), admin);
  assertEquals(result.status, 200);
  assertEquals(result.body.skipped, "missing_metadata");
  assertEquals(rpcCalls.length, 0);
});

Deno.test("subscription: unwraps expanded customer object", async () => {
  const { admin, rpcCalls } = makeAdmin();
  await handleStripeEvent(subscriptionEvent({ customer: { id: "cus_expanded" } }), admin);
  assertEquals(rpcCalls[0].args.p_stripe_customer_id, "cus_expanded");
});

Deno.test("subscription: returns 500 when the RPC errors so Stripe retries", async () => {
  const { admin } = makeAdmin({ rpcError: { message: "db_down" } });
  const result = await handleStripeEvent(subscriptionEvent({}), admin);
  assertEquals(result.status, 500);
  assertEquals(result.body.error, "widget_sub_failed");
});

// ---- unhandled event types --------------------------------------------------

Deno.test("unknown events are acked with 200 without touching the DB", async () => {
  const { admin, rpcCalls, lookupCalls } = makeAdmin();
  const event = {
    id: "evt_test_other",
    type: "customer.created",
    livemode: false,
    data: { object: {} },
  } as unknown as Stripe.Event;

  const result = await handleStripeEvent(event, admin);

  assertEquals(result.status, 200);
  assertEquals(result.body.received, true);
  assertEquals(result.body.ignored, "customer.created");
  assertEquals(rpcCalls.length, 0);
  assertEquals(lookupCalls.length, 0);
});
