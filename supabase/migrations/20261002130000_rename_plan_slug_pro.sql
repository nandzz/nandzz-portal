-- Rename the single paid plan's slug from the legacy `starter` to `pro`.
--
-- Background: 20261001120100 repurposed the `starter` row into the one paid plan
-- (name "Pro") and deactivated the old `pro` row, but kept the slug `starter` to
-- avoid touching subscribers. That slug still leaks into the admin UI (plan
-- editor subtitle, user plan badges) and `profiles.plan_slug`, where it reads as
-- "starter" even though the product only has one plan called Pro. This migration
-- makes the slug match the name.
--
-- Safe because: nothing hardcodes the slug in the billing RPCs (they take it as a
-- parameter and look the row up), `profiles.plan_slug` is plain text (no FK), and
-- the webhook resolves the plan by Stripe price id, not by the stored slug. The
-- check constraint already permits 'pro'.
--
-- NOTE: the Stripe Price ids on the row are unchanged, so no re-sync is required
-- for this rename specifically (the €27/€270 re-sync from 20261002120000 still
-- applies). Existing Stripe subscriptions carry metadata plan_slug='starter', but
-- the webhook ignores that for slug resolution, so they converge to 'pro' on the
-- next event; this migration also updates their profile rows immediately.

-- 1. Free the `pro` slug: drop the deactivated legacy row folded into the paid plan.
delete from public.subscription_plans where slug = 'pro';

-- 2. Rename the single paid plan.
update public.subscription_plans set slug = 'pro' where slug = 'starter';

-- 3. Converge existing subscribers (both the renamed `starter` cohort and anyone
--    still carrying the old `pro` slug point at the same single plan now).
update public.profiles set plan_slug = 'pro' where plan_slug = 'starter';

-- 4. Tighten the catalog slug constraint to the two slugs that now exist.
alter table public.subscription_plans
  drop constraint if exists subscription_plans_slug_check;
alter table public.subscription_plans
  add constraint subscription_plans_slug_check check (slug in ('free', 'pro'));
