-- Three-tier pricing: Free · Starter (€5/mo · €50/yr) · Pro (€27/mo · €270/yr).
-- Plan: features-doc/pricing-three-tiers.md
--
-- * New entitlement flags on subscription_plans:
--     has_styling        — custom bg/button colours, booking button style, Brand
--                          page, gallery caption styles
--     hide_branding      — hides the Nandzz "Create your page" badge on the profile
--     has_google_review  — Google review button on the profile
-- * New `starter` plan: unlimited contents, styling, no badge, analytics, Google
--   review. No booking (widgets), no MCP.
-- * Pro gains the three new flags. Free stays at 25 contents with nothing else.
-- * user_has_entitlement() learns 'styling' | 'branding' | 'google_review'.
--   Demos get styling as a perk (like widgets): they are admin-built pitches.
--
-- Reusing the slug `starter` is safe: the Stripe webhook resolves plans by
-- Stripe price id, never by the legacy `plan_slug='starter'` metadata carried by
-- old Pro subscriptions.
--
-- Stored style columns of Free users are NOT touched — they are ignored on
-- render until the owner upgrades.
--
-- NOTE (manual, per environment): Stripe ids for Starter start null. After
-- applying, open the admin Plans editor and "Sync to Stripe" to create the
-- Starter product + monthly/annual prices.

-- ── 1. Slug check ───────────────────────────────────────────────────────────
alter table public.subscription_plans
  drop constraint if exists subscription_plans_slug_check;
alter table public.subscription_plans
  add constraint subscription_plans_slug_check check (slug in ('free', 'starter', 'pro'));

-- ── 2. New entitlement flags ────────────────────────────────────────────────
alter table public.subscription_plans
  add column if not exists has_styling       boolean not null default false,
  add column if not exists hide_branding     boolean not null default false,
  add column if not exists has_google_review boolean not null default false;

-- ── 3. Catalog ──────────────────────────────────────────────────────────────
update public.subscription_plans
set has_styling = false,
    hide_branding = false,
    has_google_review = false,
    space_limit = 25
where slug = 'free';

update public.subscription_plans
set has_styling = true,
    hide_branding = true,
    has_google_review = true
where slug = 'pro';

insert into public.subscription_plans
  (slug, name, description, price_cents, annual_price_cents, currency,
   monthly_credits, space_limit, has_widgets, has_mcp, has_analytics,
   has_styling, hide_branding, has_google_review, active, sort_order)
values
  ('starter', 'Starter',
   'Your page, your brand — unlimited spaces, custom style, no Nandzz badge and analytics.',
   500, 5000, 'eur',
   0, null, false, false, true,
   true, true, true, true, 15)
on conflict (slug) do update set
  name               = excluded.name,
  description        = excluded.description,
  price_cents        = excluded.price_cents,
  annual_price_cents = excluded.annual_price_cents,
  monthly_credits    = excluded.monthly_credits,
  space_limit        = excluded.space_limit,
  has_widgets        = excluded.has_widgets,
  has_mcp            = excluded.has_mcp,
  has_analytics      = excluded.has_analytics,
  has_styling        = excluded.has_styling,
  hide_branding      = excluded.hide_branding,
  has_google_review  = excluded.has_google_review,
  active             = excluded.active,
  sort_order         = excluded.sort_order;

-- ── 4. Entitlement RPC ──────────────────────────────────────────────────────
create or replace function public.user_has_entitlement(p_user_id uuid, p_entitlement text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_entitlement
    when 'widgets'       then sp.has_widgets or p.is_demo
    when 'mcp'           then sp.has_mcp
    when 'analytics'     then sp.has_analytics
    when 'styling'       then sp.has_styling or p.is_demo
    when 'branding'      then sp.hide_branding
    when 'google_review' then sp.has_google_review
    else false
  end
  from public.profiles p
  join public.subscription_plans sp on sp.slug = p.plan_slug
  where p.id = p_user_id;
$$;

revoke all on function public.user_has_entitlement(uuid, text) from public;
grant execute on function public.user_has_entitlement(uuid, text) to authenticated, service_role;
