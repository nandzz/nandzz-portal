import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- Supabase mocks ----------------------------------------------------------
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "a@b.c" } } }) },
  }),
}));

const plans: Record<string, Record<string, unknown>> = {
  starter: {
    slug: "starter", name: "Starter", active: true, price_cents: 500, trial_days: 0,
    stripe_price_id: "price_starter_m", stripe_annual_price_id: "price_starter_y",
  },
  pro: {
    slug: "pro", name: "Pro", active: true, price_cents: 2700, trial_days: 0,
    stripe_price_id: "price_pro_m", stripe_annual_price_id: "price_pro_y",
  },
};
let profile: Record<string, unknown> = {};
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      let slug: string | null = null;
      const chain = {
        select: () => chain,
        eq: (col: string, val: string) => {
          if (col === "slug") slug = val;
          return chain;
        },
        single: async () =>
          table === "subscription_plans"
            ? { data: slug ? plans[slug] : null, error: null }
            : { data: profile, error: null },
        update: () => ({ eq: async () => ({ error: null }) }),
      };
      return chain;
    },
  }),
}));

// ---- Stripe mock -------------------------------------------------------------
const prices: Record<string, { id: string; unit_amount: number; recurring: { interval: string } }> = {
  price_starter_m: { id: "price_starter_m", unit_amount: 500, recurring: { interval: "month" } },
  price_starter_y: { id: "price_starter_y", unit_amount: 5000, recurring: { interval: "year" } },
  price_pro_m: { id: "price_pro_m", unit_amount: 2700, recurring: { interval: "month" } },
  price_pro_y: { id: "price_pro_y", unit_amount: 27000, recurring: { interval: "year" } },
};
let subscription: Record<string, unknown> | null = null;
const stripe = {
  subscriptions: {
    retrieve: vi.fn(async () => subscription),
    update: vi.fn<(id: string, params: Record<string, unknown>) => Promise<Record<string, unknown>>>(
      async () => ({ ...subscription, pending_update: null, latest_invoice: null }),
    ),
  },
  prices: { retrieve: vi.fn(async (id: string) => prices[id]) },
  customers: {
    retrieve: vi.fn(async () => ({ id: "cus_1", deleted: false })),
    create: vi.fn(async () => ({ id: "cus_new" })),
  },
  checkout: { sessions: { create: vi.fn(async () => ({ url: "https://checkout.stripe.test/s" })) } },
};
vi.mock("@/lib/stripe/server", () => ({ getStripe: () => stripe, isStripeConfigured: () => true }));
vi.mock("@/lib/stripe/legal", () => ({ checkoutLegalParams: async () => ({}) }));

const { POST } = await import("./route");

const call = (plan_slug: string, interval: "month" | "year" = "month") =>
  POST(new Request("http://x/api/stripe/plan-checkout", {
    method: "POST",
    body: JSON.stringify({ plan_slug, interval }),
  }));

const liveSub = (priceId: string, status = "active") => ({
  id: "sub_1",
  status,
  customer: "cus_1",
  items: { data: [{ id: "si_1", price: prices[priceId] }] },
});

describe("plan-checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profile = { stripe_customer_id: "cus_1", has_used_trial: true, plan_stripe_subscription_id: null };
    subscription = null;
  });

  it("opens Checkout when the user has no subscription", async () => {
    const res = await call("starter");
    expect((await res.json()).url).toBe("https://checkout.stripe.test/s");
    expect(stripe.checkout.sessions.create).toHaveBeenCalledOnce();
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it("opens Checkout when the stored subscription is canceled", async () => {
    profile.plan_stripe_subscription_id = "sub_1";
    subscription = liveSub("price_starter_m", "canceled");
    await call("pro");
    expect(stripe.checkout.sessions.create).toHaveBeenCalledOnce();
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it("Starter → Pro swaps the price in place, invoiced now and applied only once paid", async () => {
    profile.plan_stripe_subscription_id = "sub_1";
    subscription = liveSub("price_starter_m");
    const res = await call("pro");

    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    const [id, params] = stripe.subscriptions.update.mock.calls[0];
    expect(id).toBe("sub_1");
    expect(params).toMatchObject({
      items: [{ id: "si_1", price: "price_pro_m" }],
      proration_behavior: "always_invoice",
      payment_behavior: "pending_if_incomplete",
    });
    expect(params).not.toHaveProperty("metadata");
    // Applied → metadata refreshed in a second call.
    expect(stripe.subscriptions.update.mock.calls[1][1]).toEqual({
      metadata: { user_id: "user-1", plan_slug: "pro", interval: "month" },
    });
    expect((await res.json()).url).toMatch(/\/dashboard\/subscription\?switched=1$/);
  });

  it("an upgrade needing payment action sends the user to the hosted invoice", async () => {
    profile.plan_stripe_subscription_id = "sub_1";
    subscription = liveSub("price_starter_m");
    stripe.subscriptions.update.mockResolvedValueOnce({
      ...subscription,
      pending_update: { expires_at: 1 },
      latest_invoice: { hosted_invoice_url: "https://invoice.stripe.test/i" },
    });
    const res = await call("pro");
    expect((await res.json()).url).toBe("https://invoice.stripe.test/i");
    expect(stripe.subscriptions.update).toHaveBeenCalledOnce(); // no metadata refresh while pending
  });

  it("Pro → Starter applies now with a credit for unused time", async () => {
    profile.plan_stripe_subscription_id = "sub_1";
    subscription = liveSub("price_pro_m");
    await call("starter");
    expect(stripe.subscriptions.update.mock.calls[0][1]).toMatchObject({
      items: [{ id: "si_1", price: "price_starter_m" }],
      proration_behavior: "create_prorations",
      metadata: { user_id: "user-1", plan_slug: "starter", interval: "month" },
    });
    expect(stripe.subscriptions.update.mock.calls[0][1]).not.toHaveProperty("payment_behavior");
  });

  it("Pro monthly → Starter annual counts as a downgrade (per-month amount)", async () => {
    profile.plan_stripe_subscription_id = "sub_1";
    subscription = liveSub("price_pro_m");
    await call("starter", "year");
    expect(stripe.subscriptions.update.mock.calls[0][1]).toMatchObject({
      items: [{ id: "si_1", price: "price_starter_y" }],
      proration_behavior: "create_prorations",
    });
  });

  it("does nothing when already on the same price", async () => {
    profile.plan_stripe_subscription_id = "sub_1";
    subscription = liveSub("price_pro_m");
    const res = await call("pro");
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect((await res.json()).url).toMatch(/\/dashboard\/subscription$/);
  });

  it("never touches a subscription that belongs to another customer", async () => {
    profile.plan_stripe_subscription_id = "sub_1";
    subscription = { ...liveSub("price_starter_m"), customer: "cus_other" };
    await call("pro");
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).toHaveBeenCalledOnce();
  });
});

describe("plan-checkout interval=current", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profile = { stripe_customer_id: "cus_1", has_used_trial: true, plan_stripe_subscription_id: "sub_1" };
  });

  it("a yearly Pro switching to Starter stays yearly", async () => {
    subscription = liveSub("price_pro_y");
    await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ plan_slug: "starter", interval: "current" }) }));
    expect(stripe.subscriptions.update.mock.calls[0][1]).toMatchObject({
      items: [{ id: "si_1", price: "price_starter_y" }],
      proration_behavior: "create_prorations",
    });
  });

  it("a monthly Pro switching to Starter stays monthly", async () => {
    subscription = liveSub("price_pro_m");
    await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ plan_slug: "starter", interval: "current" }) }));
    expect(stripe.subscriptions.update.mock.calls[0][1]).toMatchObject({
      items: [{ id: "si_1", price: "price_starter_m" }],
    });
  });
});
