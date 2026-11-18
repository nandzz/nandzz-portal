import {
  assertEquals,
  assertObjectMatch,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import type Stripe from "https://esm.sh/stripe@17?target=denonext";
import {
  handleStripeEvent,
  type AdminClientLike,
} from "../handler.ts";

// ---- Fake admin client ------------------------------------------------------
// Records every RPC / query call so tests can assert on them. `lookups` maps a
// table name to the result its maybeSingle() should resolve with.

interface RpcCall {
  name: string;
  args: Record<string, unknown>;
}

interface FakeAdminOptions {
  rpcError?: unknown;
  updateError?: unknown;
  // deno-lint-ignore no-explicit-any
  lookups?: Record<string, { data: any; error: unknown }>;
}

function makeAdmin(opts: FakeAdminOptions = {}): {
  admin: AdminClientLike;
  rpcCalls: RpcCall[];
  lookupCalls: Array<{ table: string; filters: Array<[string, unknown]> }>;
  updateCalls: Array<{
    table: string;
    values: Record<string, unknown>;
    filters: Array<[string, unknown]>;
  }>;
} {
  const rpcCalls: RpcCall[] = [];
  const lookupCalls: Array<{ table: string; filters: Array<[string, unknown]> }> =
    [];
  const updateCalls: Array<{
    table: string;
    values: Record<string, unknown>;
    filters: Array<[string, unknown]>;
  }> = [];

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
        or: (filter: string) => {
          filters.push(["or", filter]);
          return chain;
        },
        maybeSingle: () => {
          lookupCalls.push({ table, filters: [...filters] });
          return Promise.resolve(
            opts.lookups?.[table] ?? { data: null, error: null },
          );
        },
        update: (values: Record<string, unknown>) => ({
          eq: (col: string, val: unknown) => {
            updateCalls.push({ table, values, filters: [[col, val]] });
            return Promise.resolve({ error: opts.updateError ?? null });
          },
        }),
      };
      return chain as ReturnType<AdminClientLike["from"]>;
    },
  };

  return { admin, rpcCalls, lookupCalls, updateCalls };
}

// ---- Event factories --------------------------------------------------------

// ---- customer.subscription.* (plan subscriptions) ---------------------------

function subscriptionEvent(overrides: {
  type?: string;
  metadata?: Record<string, string> | null;
  status?: string;
  priceId?: string | null;
  subId?: string;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  cancelAt?: number | null;
  eventId?: string;
}): Stripe.Event {
  return {
    id: overrides.eventId ?? "evt_test_sub",
    type: overrides.type ?? "customer.subscription.created",
    livemode: false,
    created: 1_700_000_000,
    data: {
      object: {
        id: overrides.subId ?? "sub_test_123",
        status: overrides.status ?? "active",
        current_period_end:
          "currentPeriodEnd" in overrides ? overrides.currentPeriodEnd : 1_700_100_000,
        cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
        cancel_at: "cancelAt" in overrides ? overrides.cancelAt : null,
        items: {
          data: [
            {
              price: {
                id: "priceId" in overrides ? overrides.priceId : "price_pro",
              },
            },
          ],
        },
        metadata:
          overrides.metadata === undefined
            ? { user_id: "user-1" }
            : overrides.metadata ?? {},
      } as unknown as Stripe.Subscription,
    },
  } as unknown as Stripe.Event;
}

Deno.test("subscription.created: maps price→plan and calls set_user_plan", async () => {
  const { admin, rpcCalls, lookupCalls } = makeAdmin({
    lookups: { subscription_plans: { data: { slug: "pro" }, error: null } },
  });
  const result = await handleStripeEvent(subscriptionEvent({}), admin);

  assertEquals(result.status, 200);
  assertEquals(result.body.plan_slug, "pro");
  assertEquals(result.body.plan_status, "active");

  // price → plan lookup
  assertEquals(lookupCalls[0].table, "subscription_plans");
  assertEquals(lookupCalls[0].filters, [["or", "stripe_price_id.eq.price_pro,stripe_annual_price_id.eq.price_pro"]]);

  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].name, "set_user_plan");
  assertObjectMatch(rpcCalls[0].args, {
    p_user_id: "user-1",
    p_plan_slug: "pro",
    p_status: "active",
    p_sub_id: "sub_test_123",
  });
  assertEquals(
    rpcCalls[0].args.p_period_end,
    new Date(1_700_100_000 * 1000).toISOString(),
  );
  // A normal renewing sub is not marked as canceling.
  assertEquals(rpcCalls[0].args.p_cancel_at_period_end, false);
});

Deno.test("subscription.updated with cancel_at_period_end: stores the canceling flag", async () => {
  const { admin, rpcCalls } = makeAdmin({
    lookups: { subscription_plans: { data: { slug: "pro" }, error: null } },
  });
  const result = await handleStripeEvent(
    subscriptionEvent({ type: "customer.subscription.updated", cancelAtPeriodEnd: true }),
    admin,
  );

  assertEquals(result.status, 200);
  // Stripe keeps status "active" — only the flag signals the wind-down.
  assertEquals(result.body.plan_status, "active");
  assertEquals(rpcCalls[0].name, "set_user_plan");
  assertEquals(rpcCalls[0].args.p_cancel_at_period_end, true);
});

Deno.test("subscription.updated with a future cancel_at (modern Stripe portal): marks canceling + uses cancel_at as the end date", async () => {
  const { admin, rpcCalls } = makeAdmin({
    lookups: { subscription_plans: { data: { slug: "pro" }, error: null } },
  });
  const cancelAt = 1_791_582_700;
  const result = await handleStripeEvent(
    // The portal now leaves cancel_at_period_end=false and sets cancel_at instead.
    subscriptionEvent({ type: "customer.subscription.updated", cancelAt }),
    admin,
  );

  assertEquals(result.status, 200);
  assertEquals(result.body.plan_status, "active");
  assertEquals(rpcCalls[0].args.p_cancel_at_period_end, true);
  // The displayed "active until" date comes from cancel_at, not current_period_end.
  assertEquals(rpcCalls[0].args.p_period_end, new Date(cancelAt * 1000).toISOString());
});

Deno.test("subscription trialing: burns the one-time trial (has_used_trial=true)", async () => {
  const { admin, rpcCalls, updateCalls } = makeAdmin({
    lookups: { subscription_plans: { data: { slug: "pro" }, error: null } },
  });
  const result = await handleStripeEvent(
    subscriptionEvent({ status: "trialing" }),
    admin,
  );

  assertEquals(result.status, 200);
  assertEquals(result.body.plan_status, "trialing");
  assertEquals(rpcCalls[0].name, "set_user_plan");
  // The profile is flagged so a later resubscribe can't trial again.
  assertEquals(updateCalls.length, 1);
  assertEquals(updateCalls[0].table, "profiles");
  assertObjectMatch(updateCalls[0].values, { has_used_trial: true });
  assertEquals(updateCalls[0].filters, [["id", "user-1"]]);
});

Deno.test("subscription active: does NOT touch has_used_trial", async () => {
  const { admin, updateCalls } = makeAdmin({
    lookups: { subscription_plans: { data: { slug: "pro" }, error: null } },
  });
  const result = await handleStripeEvent(subscriptionEvent({ status: "active" }), admin);

  assertEquals(result.status, 200);
  assertEquals(updateCalls.length, 0);
});

Deno.test("subscription.deleted: downgrades to free without a price lookup", async () => {
  const { admin, rpcCalls, lookupCalls } = makeAdmin();
  const result = await handleStripeEvent(
    subscriptionEvent({ type: "customer.subscription.deleted", status: "canceled" }),
    admin,
  );

  assertEquals(result.status, 200);
  assertEquals(result.body.plan_slug, "free");
  assertEquals(result.body.plan_status, "canceled");
  assertEquals(lookupCalls.length, 0, "deletion needs no price/plan lookup");
  assertEquals(rpcCalls.length, 1);
  assertObjectMatch(rpcCalls[0].args, {
    p_user_id: "user-1",
    p_plan_slug: "free",
    p_status: "canceled",
    p_period_end: null,
  });
});

Deno.test("subscription: unknown price maps to no plan and is acked without a write", async () => {
  const { admin, rpcCalls } = makeAdmin({
    lookups: { subscription_plans: { data: null, error: null } },
  });
  const result = await handleStripeEvent(
    subscriptionEvent({ priceId: "price_unknown" }),
    admin,
  );
  assertEquals(result.status, 200);
  assertEquals(result.body.skipped, "unknown_price");
  assertEquals(rpcCalls.length, 0);
});

Deno.test("subscription: resolves user via lookup when metadata has no user_id", async () => {
  const { admin, rpcCalls, lookupCalls } = makeAdmin({
    lookups: {
      subscription_plans: { data: { slug: "pro" }, error: null },
      profiles: { data: { id: "user-9" }, error: null },
    },
  });
  const result = await handleStripeEvent(subscriptionEvent({ metadata: {} }), admin);

  assertEquals(result.status, 200);
  assertEquals(result.body.plan_slug, "pro");
  // second lookup resolves the user by stored subscription id
  const profileLookup = lookupCalls.find((c) => c.table === "profiles");
  assertEquals(profileLookup?.filters, [["plan_stripe_subscription_id", "sub_test_123"]]);
  assertEquals(rpcCalls[0].args.p_user_id, "user-9");
});

Deno.test("subscription: skips when no user can be resolved", async () => {
  const { admin, rpcCalls } = makeAdmin({
    lookups: {
      subscription_plans: { data: { slug: "pro" }, error: null },
      profiles: { data: null, error: null },
    },
  });
  const result = await handleStripeEvent(subscriptionEvent({ metadata: {} }), admin);
  assertEquals(result.status, 200);
  assertEquals(result.body.skipped, "missing_user");
  assertEquals(rpcCalls.length, 0);
});

Deno.test("subscription: returns 500 when set_user_plan errors so Stripe retries", async () => {
  const { admin } = makeAdmin({
    lookups: { subscription_plans: { data: { slug: "pro" }, error: null } },
    rpcError: { message: "db_down" },
  });
  const result = await handleStripeEvent(subscriptionEvent({}), admin);
  assertEquals(result.status, 500);
  assertEquals(result.body.error, "plan_update_failed");
});

Deno.test("subscription: legacy per-instance widget sub (instance_id) is ignored, never touches plan state", async () => {
  const { admin, rpcCalls, lookupCalls } = makeAdmin();
  // A widget subscription.deleted must NOT downgrade the owner's plan.
  const result = await handleStripeEvent(
    subscriptionEvent({
      type: "customer.subscription.deleted",
      metadata: { user_id: "user-1", instance_id: "inst-1", catalog_id: "cat-1" },
    }),
    admin,
  );
  assertEquals(result.status, 200);
  assertEquals(result.body.skipped, "legacy_widget");
  assertEquals(rpcCalls.length, 0, "no RPC should fire for a legacy widget sub");
  assertEquals(lookupCalls.length, 0);
});

// ---- invoice.paid -----------------------------------------------------------

function invoiceEvent(overrides: {
  priceId?: string | null;
  subId?: string | null;
  userId?: string | null;
  periodEnd?: number | null;
  eventId?: string;
}): Stripe.Event {
  return {
    id: overrides.eventId ?? "evt_test_invoice",
    type: "invoice.paid",
    livemode: false,
    created: 1_700_000_000,
    data: {
      object: {
        id: "in_test_1",
        subscription: "subId" in overrides ? overrides.subId : "sub_test_123",
        subscription_details: {
          metadata: { user_id: "userId" in overrides ? overrides.userId : "user-1" },
        },
        lines: {
          data: [
            {
              price: { id: "priceId" in overrides ? overrides.priceId : "price_pro" },
              period: {
                end: "periodEnd" in overrides ? overrides.periodEnd : 1_702_700_000,
              },
            },
          ],
        },
      },
    },
  } as unknown as Stripe.Event;
}

Deno.test("invoice.paid: updates plan state", async () => {
  const { admin, rpcCalls } = makeAdmin({
    lookups: { subscription_plans: { data: { slug: "pro" }, error: null } },
  });
  const result = await handleStripeEvent(invoiceEvent({}), admin);

  assertEquals(result.status, 200);
  assertEquals(result.body.plan, "pro");
  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].name, "set_user_plan");
  assertObjectMatch(rpcCalls[0].args, {
    p_user_id: "user-1",
    p_plan_slug: "pro",
    p_status: "active",
    p_sub_id: "sub_test_123",
  });
  assertEquals(
    rpcCalls[0].args.p_period_end,
    new Date(1_702_700_000 * 1000).toISOString(),
  );
});

Deno.test("invoice.paid: skips when the price maps to no plan", async () => {
  const { admin, rpcCalls } = makeAdmin({
    lookups: { subscription_plans: { data: null, error: null } },
  });
  const result = await handleStripeEvent(invoiceEvent({ priceId: "price_x" }), admin);
  assertEquals(result.status, 200);
  assertEquals(result.body.skipped, "unknown_price");
  assertEquals(rpcCalls.length, 0);
});

Deno.test("invoice.paid: skips when subscription/price is missing", async () => {
  const { admin, rpcCalls } = makeAdmin();
  const result = await handleStripeEvent(invoiceEvent({ subId: null }), admin);
  assertEquals(result.status, 200);
  assertEquals(result.body.skipped, "missing_sub_or_price");
  assertEquals(rpcCalls.length, 0);
});

Deno.test("invoice.paid: resolves user_id from invoice.parent.subscription_details (current Stripe API)", async () => {
  const { admin, rpcCalls, lookupCalls } = makeAdmin({
    lookups: { subscription_plans: { data: { slug: "pro" }, error: null } },
  });
  // Current Stripe API version: no top-level subscription/price, metadata under parent.
  const event = {
    id: "evt_test_invoice_parent",
    type: "invoice.paid",
    livemode: false,
    created: 1_700_000_000,
    data: {
      object: {
        id: "in_test_parent",
        parent: {
          type: "subscription_details",
          subscription_details: {
            subscription: "sub_parent_1",
            metadata: { user_id: "user-7", plan_slug: "pro" },
          },
        },
        lines: {
          data: [
            {
              pricing: { price_details: { price: "price_pro" } },
              period: { end: 1_702_700_000 },
            },
          ],
        },
      },
    },
  } as unknown as Stripe.Event;

  const result = await handleStripeEvent(event, admin);
  assertEquals(result.status, 200);
  assertEquals(result.body.plan, "pro");
  assertEquals(lookupCalls[0].filters, [["or", "stripe_price_id.eq.price_pro,stripe_annual_price_id.eq.price_pro"]]);
  assertEquals(rpcCalls[0].name, "set_user_plan");
  assertEquals(rpcCalls[0].args.p_user_id, "user-7");
  assertEquals(rpcCalls[0].args.p_sub_id, "sub_parent_1");
});

Deno.test("invoice.paid: legacy per-instance widget invoice (instance_id) is ignored", async () => {
  const { admin, rpcCalls } = makeAdmin({
    lookups: { subscription_plans: { data: { slug: "pro" }, error: null } },
  });
  const event = {
    id: "evt_test_widget_invoice",
    type: "invoice.paid",
    livemode: false,
    created: 1_700_000_000,
    data: {
      object: {
        id: "in_widget_1",
        subscription: "sub_widget_1",
        subscription_details: { metadata: { user_id: "user-1", instance_id: "inst-1" } },
        lines: { data: [{ price: { id: "price_widget" }, period: { end: 1_702_700_000 } }] },
      },
    },
  } as unknown as Stripe.Event;

  const result = await handleStripeEvent(event, admin);
  assertEquals(result.status, 200);
  assertEquals(result.body.skipped, "legacy_widget");
  assertEquals(rpcCalls.length, 0);
});

Deno.test("invoice.paid: returns 500 when set_user_plan errors so Stripe retries", async () => {
  const { admin } = makeAdmin({
    lookups: { subscription_plans: { data: { slug: "pro" }, error: null } },
    rpcError: { message: "db_down" },
  });
  const result = await handleStripeEvent(invoiceEvent({}), admin);
  assertEquals(result.status, 500);
  assertEquals(result.body.error, "plan_update_failed");
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

// ---- Three-tier pricing: Starter ↔ Pro switches ------------------------------
// plan-checkout swaps the price on the existing subscription (never a second
// Checkout); the resulting subscription.updated must move the profile to the
// plan of the NEW price, even when the metadata still names the old slug.

Deno.test("subscription.updated Starter → Pro: maps the new price, ignores stale metadata", async () => {
  const { admin, rpcCalls, lookupCalls } = makeAdmin({
    lookups: { subscription_plans: { data: { slug: "pro" }, error: null } },
  });
  const result = await handleStripeEvent(
    subscriptionEvent({
      type: "customer.subscription.updated",
      priceId: "price_pro",
      metadata: { user_id: "user-1", plan_slug: "starter" },
    }),
    admin,
  );

  assertEquals(result.status, 200);
  assertEquals(result.body.plan_slug, "pro");
  assertEquals(lookupCalls[0].filters, [["or", "stripe_price_id.eq.price_pro,stripe_annual_price_id.eq.price_pro"]]);
  assertObjectMatch(rpcCalls[0].args, { p_user_id: "user-1", p_plan_slug: "pro", p_sub_id: "sub_test_123" });
});

Deno.test("subscription.updated Pro → Starter (annual price): maps to starter", async () => {
  const { admin, rpcCalls, lookupCalls } = makeAdmin({
    lookups: { subscription_plans: { data: { slug: "starter" }, error: null } },
  });
  const result = await handleStripeEvent(
    subscriptionEvent({
      type: "customer.subscription.updated",
      priceId: "price_starter_year",
      metadata: { user_id: "user-1", plan_slug: "pro" },
    }),
    admin,
  );

  assertEquals(result.status, 200);
  assertEquals(result.body.plan_slug, "starter");
  assertEquals(lookupCalls[0].filters, [
    ["or", "stripe_price_id.eq.price_starter_year,stripe_annual_price_id.eq.price_starter_year"],
  ]);
  assertObjectMatch(rpcCalls[0].args, { p_user_id: "user-1", p_plan_slug: "starter", p_status: "active" });
});
