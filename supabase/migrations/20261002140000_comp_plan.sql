-- Complimentary ("comp") Pro access.
--
-- Lets an admin grant a user the full Pro plan for a fixed number of days
-- WITHOUT a Stripe subscription, so prospects/partners can evaluate paid
-- features (Booking, MCP, Analytics). This is deliberately NOT the one-time
-- Stripe free trial: a comp grant never touches `has_used_trial`, so a user who
-- consumed a comp period still receives their free trial if they later
-- subscribe for real.
--
-- Representation: entitlements already resolve purely from
-- `profiles.plan_slug -> subscription_plans`, so a comp = point `plan_slug='pro'`
-- with a distinct `plan_status='comp'` and an expiry timestamp. No gate changes
-- needed. Expiry is enforced by an hourly pg_cron sweep (expire_comp_plans),
-- mirroring how Stripe cancellation downgrades a profile back to Free.

-- ── Columns ───────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists comp_expires_at timestamptz,
  add column if not exists comp_granted_by uuid references public.profiles(id),
  add column if not exists comp_note text;

-- ══════════════════════════════════════════════════════════════════════════════
-- grant_comp_plan — give a user complimentary Pro for p_days days.
-- ══════════════════════════════════════════════════════════════════════════════
-- Blocks users who already have a real (Stripe-backed) active/trialing plan, so
-- a comp never collides with webhook-driven billing state. Never writes
-- has_used_trial / stripe_customer_id / plan_stripe_subscription_id.
create or replace function public.grant_comp_plan(
  p_user_id    uuid,
  p_days       int,
  p_granted_by uuid,
  p_note       text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.profiles%rowtype;
begin
  if coalesce(p_days, 0) <= 0 then
    raise exception 'p_days must be a positive integer' using errcode = 'P0001';
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'p_note is required' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.subscription_plans where slug = 'pro') then
    raise exception 'plan not found: pro' using errcode = 'P0001';
  end if;

  select * into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0001';
  end if;

  -- Refuse to overwrite a genuine paid/trialing subscription — the next Stripe
  -- webhook event would clobber the comp anyway. Comp is for non-subscribers.
  if v_old.plan_status in ('active', 'trialing')
     and v_old.plan_stripe_subscription_id is not null then
    raise exception 'user already has an active subscription' using errcode = 'P0002';
  end if;

  update public.profiles set
    plan_slug       = 'pro',
    plan_status     = 'comp',
    comp_expires_at = now() + make_interval(days => p_days),
    comp_granted_by = p_granted_by,
    comp_note       = p_note
  where id = p_user_id;

  -- Parity with a real activation (keeps the plan_refill ledger row consistent).
  -- No-op on credits under the current catalog where pro.monthly_credits = 0.
  perform public.refill_plan_credits(p_user_id, 'pro');
end;
$$;

revoke all on function public.grant_comp_plan(uuid, int, uuid, text) from public;
grant execute on function public.grant_comp_plan(uuid, int, uuid, text) to service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- revoke_comp_plan — end a comp immediately, downgrade to Free.
-- ══════════════════════════════════════════════════════════════════════════════
-- Guarded on plan_status='comp' so it can never downgrade a real subscriber.
create or replace function public.revoke_comp_plan(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set
    plan_slug       = 'free',
    plan_status     = null,
    comp_expires_at = null,
    comp_granted_by = null,
    comp_note       = null
  where id = p_user_id
    and plan_status = 'comp';
end;
$$;

revoke all on function public.revoke_comp_plan(uuid) from public;
grant execute on function public.revoke_comp_plan(uuid) to service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- expire_comp_plans — sweep expired comps back to Free. Run by pg_cron hourly.
-- ══════════════════════════════════════════════════════════════════════════════
create or replace function public.expire_comp_plans()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set
    plan_slug       = 'free',
    plan_status     = null,
    comp_expires_at = null,
    comp_granted_by = null,
    comp_note       = null
  where plan_status = 'comp'
    and comp_expires_at is not null
    and comp_expires_at < now();
end;
$$;

revoke all on function public.expire_comp_plans() from public;
grant execute on function public.expire_comp_plans() to service_role;

-- (Re)schedule the sweep idempotently.
select cron.unschedule('expire-comp-plans')
  where exists (select 1 from cron.job where jobname = 'expire-comp-plans');
select cron.schedule(
  'expire-comp-plans',
  '0 * * * *',
  $$select public.expire_comp_plans()$$
);

-- ══════════════════════════════════════════════════════════════════════════════
-- set_user_plan — now also clears comp state when a real plan activates.
-- ══════════════════════════════════════════════════════════════════════════════
-- Identical to the original (20260816120200_billing_rpcs.sql) except that a
-- transition into active/trialing wipes the comp_* fields, so a comp user who
-- subsequently subscribes for real leaves no stale comp state behind.
create or replace function public.set_user_plan(
  p_user_id    uuid,
  p_plan_slug  text,
  p_status     text,
  p_sub_id     text,
  p_period_end timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old           public.profiles%rowtype;
  v_became_active boolean;
begin
  if not exists (select 1 from public.subscription_plans where slug = p_plan_slug) then
    raise exception 'plan not found: %', p_plan_slug using errcode = 'P0001';
  end if;

  select * into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0001';
  end if;

  v_became_active :=
    p_status in ('active', 'trialing')
    and (
      v_old.plan_slug is distinct from p_plan_slug
      or coalesce(v_old.plan_status, '') not in ('active', 'trialing')
    );

  update public.profiles set
    plan_slug                   = p_plan_slug,
    plan_status                 = p_status,
    plan_stripe_subscription_id = p_sub_id,
    plan_current_period_end     = p_period_end,
    -- A real subscription supersedes any complimentary grant.
    comp_expires_at = case when p_status in ('active', 'trialing') then null else comp_expires_at end,
    comp_granted_by = case when p_status in ('active', 'trialing') then null else comp_granted_by end,
    comp_note       = case when p_status in ('active', 'trialing') then null else comp_note end
  where id = p_user_id;

  if v_became_active then
    perform public.refill_plan_credits(p_user_id, p_plan_slug);
  end if;
end;
$$;

revoke all on function public.set_user_plan(uuid, text, text, text, timestamptz) from public;
grant execute on function public.set_user_plan(uuid, text, text, text, timestamptz) to service_role;
