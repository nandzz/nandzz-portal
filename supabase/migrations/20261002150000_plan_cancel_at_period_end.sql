-- Track "subscription set to cancel at period end" so the UI can show
-- "active until <date>" + a reactivate CTA instead of "renews <date>".
--
-- When a user cancels in the Stripe customer portal, Stripe keeps the
-- subscription status = "active" (it only flips to "canceled" at period end)
-- and fires customer.subscription.updated with cancel_at_period_end = true.
-- We previously threw that flag away, so a cancelled-but-still-active plan was
-- indistinguishable from a renewing one.

alter table public.profiles
  add column if not exists plan_cancel_at_period_end boolean not null default false;

-- set_user_plan gains a p_cancel_at_period_end arg. The signature changes, so
-- drop the old 5-arg version first (a default-valued 6th arg would otherwise make
-- named-param calls ambiguous between the two overloads).
drop function if exists public.set_user_plan(uuid, text, text, text, timestamptz);

create or replace function public.set_user_plan(
  p_user_id              uuid,
  p_plan_slug            text,
  p_status               text,
  p_sub_id               text,
  p_period_end           timestamptz,
  p_cancel_at_period_end boolean default false
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
    plan_slug                 = p_plan_slug,
    plan_status               = p_status,
    plan_stripe_subscription_id = p_sub_id,
    plan_current_period_end   = p_period_end,
    plan_cancel_at_period_end = coalesce(p_cancel_at_period_end, false)
  where id = p_user_id;

  if v_became_active then
    perform public.refill_plan_credits(p_user_id, p_plan_slug);
  end if;
end;
$$;

revoke all on function public.set_user_plan(uuid, text, text, text, timestamptz, boolean) from public;
grant execute on function public.set_user_plan(uuid, text, text, text, timestamptz, boolean) to service_role;
