-- Single paid plan: price change (€27/mo) + annual billing option.
--
-- Builds on 20261001120100_single_paid_plan, which collapsed the catalog to
-- Free + one paid plan (slug `starter`, name "Pro") and deactivated slug `pro`.
-- Here we:
--   * add `annual_price_cents` / `stripe_annual_price_id` to subscription_plans,
--   * reprice the single paid plan to €27/month (2700) and €270/year (27000)
--     — 2 months free, ~€22.50/mo effective.
--
-- IMPORTANT (manual, per environment): changing price_cents / annual_price_cents
-- here does NOT rotate the Stripe recurring Prices. Stripe Price ids are stored
-- in stripe_price_id (monthly) and stripe_annual_price_id (annual). After applying
-- this migration an admin MUST open nandzz-admin's Plans editor and "Sync to
-- Stripe" so BOTH columns are repopulated with Prices that match these amounts.
-- Annual checkout fails with a clear error until stripe_annual_price_id is set.

alter table public.subscription_plans
  add column if not exists annual_price_cents integer,
  add column if not exists stripe_annual_price_id text;

update public.subscription_plans
set
  price_cents = 2700,
  annual_price_cents = 27000
where slug = 'starter';
