-- Admin-granted free ("comp") widget access.
--
-- Lets an admin give a user access to a widget type without a real Stripe
-- subscription, and pull it back later. A comp grant is just a
-- widget_subscriptions row (same entitlement table `has_widget_access`
-- already reads) flagged `is_comp = true` with no expiry. Deactivating one
-- only flips `status`, never touches widget_instances — so the owner's
-- config (services, availability, staff, …) survives a revoke/re-grant
-- cycle untouched.

alter table public.widget_subscriptions
  add column if not exists is_comp     boolean not null default false,
  add column if not exists granted_by  uuid references public.profiles(id) on delete set null,
  add column if not exists comp_note   text;

create index if not exists widget_subscriptions_comp
  on public.widget_subscriptions(is_comp)
  where is_comp = true;

-- ── RPC: grant_widget_comp ───────────────────────────────────────────────
-- Finds or creates the (user, catalog) instance, then upserts the
-- entitlement row as an active, non-expiring comp grant. Calling it again
-- on an existing grant (e.g. "reactivate") just flips status back to
-- active — instance/config are only created once, never reset.
create or replace function public.grant_widget_comp(
  p_user_id    uuid,
  p_catalog_id uuid,
  p_granted_by uuid,
  p_note       text default null
)
returns public.widget_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance public.widget_instances%rowtype;
  v_sub      public.widget_subscriptions%rowtype;
begin
  select * into v_instance
  from public.widget_instances
  where user_id = p_user_id and catalog_id = p_catalog_id;

  if not found then
    insert into public.widget_instances (user_id, catalog_id, enabled, config)
    values (p_user_id, p_catalog_id, false, '{}'::jsonb)
    returning * into v_instance;
  end if;

  select * into v_sub
  from public.widget_subscriptions
  where instance_id = v_instance.id
  for update;

  if found then
    update public.widget_subscriptions set
      is_comp            = true,
      status             = 'active',
      current_period_end = null,
      granted_by         = p_granted_by,
      comp_note          = coalesce(p_note, v_sub.comp_note)
    where id = v_sub.id
    returning * into v_sub;
  else
    insert into public.widget_subscriptions (
      user_id, instance_id, catalog_id, status, is_comp, granted_by, comp_note
    ) values (
      p_user_id, v_instance.id, p_catalog_id, 'active', true, p_granted_by, p_note
    )
    returning * into v_sub;
  end if;

  return v_sub;
end;
$$;

revoke all on function public.grant_widget_comp(uuid, uuid, uuid, text) from public;
grant execute on function public.grant_widget_comp(uuid, uuid, uuid, text) to service_role;

-- ── RPC: set_widget_comp_active ──────────────────────────────────────────
-- Toggle an existing comp grant off/on. Refuses to touch a row that isn't
-- a comp grant (`is_comp = false`) — a real Stripe subscription must be
-- cancelled in Stripe, not flipped here, or billing state drifts from the
-- DB (see grant_widget_subscription, which owns that path).
create or replace function public.set_widget_comp_active(
  p_subscription_id uuid,
  p_active          boolean
)
returns public.widget_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.widget_subscriptions%rowtype;
begin
  select * into v_sub from public.widget_subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not v_sub.is_comp then
    raise exception 'NOT_COMP' using errcode = 'P0001';
  end if;

  update public.widget_subscriptions
  set status = case when p_active then 'active' else 'canceled' end
  where id = p_subscription_id
  returning * into v_sub;

  return v_sub;
end;
$$;

revoke all on function public.set_widget_comp_active(uuid, boolean) from public;
grant execute on function public.set_widget_comp_active(uuid, boolean) to service_role;
