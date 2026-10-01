-- Pricing simplification: Free + ONE paid plan at €28/month, no AI credits.
--
-- AI is being paused (see 20261001120000_ai_feature_flag), so the plan catalog
-- collapses to two tiers:
--   * free  — unchanged.
--   * paid  — reuses the existing `starter` slug (keeps the Stripe/webhook slug
--             logic and current subscribers intact) but is repriced to €28 and
--             granted every NON-AI entitlement: booking widgets, analytics, MCP
--             and unlimited spaces. monthly_credits is zeroed (no AI credits).
--   * pro   — deactivated (folded into the single paid plan).
--
-- NOTE (manual, per environment): changing price_cents here does NOT rotate the
-- Stripe recurring Price. After applying this migration, open the admin
-- Plans editor and save / "Sync to Stripe" so `stripe_price_id` matches €28.

update public.subscription_plans
set
  name = 'Pro',
  description = 'Everything to get found & booked — booking widget, analytics, MCP and unlimited spaces.',
  price_cents = 2800,
  currency = 'eur',
  monthly_credits = 0,
  space_limit = null,
  has_widgets = true,
  has_mcp = true,
  has_analytics = true,
  active = true,
  sort_order = 20
where slug = 'starter';

update public.subscription_plans
set active = false
where slug = 'pro';
