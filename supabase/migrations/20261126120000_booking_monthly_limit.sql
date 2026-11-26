-- Monthly booking cap per plan (Starter: 200 bookings/month through the public link).
--
-- `subscription_plans.monthly_booking_limit` (null ⇒ unlimited) is edited from
-- nandzz-admin → Plans. It caps bookings made by CUSTOMERS (public booking page,
-- embed, agent) — rows whose created_by_user_id is not the owner — created in the
-- current calendar month (UTC). Owner-created bookings from the dashboard are never
-- capped and don't count. Demo profiles are exempt.
--
-- When the cap is reached the portal hides the booking button and the public link
-- shows a "contact us on WhatsApp" card; the trigger below is the hard backstop.

alter table public.subscription_plans
  add column if not exists monthly_booking_limit int
    check (monthly_booking_limit is null or monthly_booking_limit >= 0);

-- Starter now includes booking, capped at 200 customer bookings per month.
update public.subscription_plans
   set monthly_booking_limit = 200, has_widgets = true
 where slug = 'starter';

create index if not exists idx_widget_bookings_owner_created
  on public.widget_bookings(owner_user_id, created_at);

-- Current month's usage for an owner. limit_count null ⇒ unlimited.
create or replace function public.booking_limit_status(p_owner uuid)
returns table (limit_count int, used_count int, reached boolean)
language sql
stable
security definer
set search_path = public
as $$
  with lim as (
    select case when p.is_demo then null else sp.monthly_booking_limit end as l
      from public.profiles p
      left join public.subscription_plans sp on sp.slug = p.plan_slug
     where p.id = p_owner
  ), used as (
    select count(*)::int as n
      from public.widget_bookings b
     where b.owner_user_id = p_owner
       and b.created_by_user_id is distinct from p_owner
       and b.created_at >= (date_trunc('month', now() at time zone 'UTC') at time zone 'UTC')
  )
  select lim.l, used.n, (lim.l is not null and used.n >= lim.l)
    from used left join lim on true;
$$;

revoke all on function public.booking_limit_status(uuid) from public, anon, authenticated;
grant execute on function public.booking_limit_status(uuid) to service_role;

-- Hard backstop: reject customer bookings once the month's cap is reached.
create or replace function public.widget_bookings_enforce_monthly_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by_user_id is not distinct from new.owner_user_id then
    return new; -- the owner's own (dashboard) bookings are never capped
  end if;
  if exists (select 1 from public.booking_limit_status(new.owner_user_id) s where s.reached) then
    raise exception 'BOOKING_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.widget_bookings_enforce_monthly_limit() from public, anon, authenticated;

drop trigger if exists widget_bookings_enforce_monthly_limit on public.widget_bookings;
create trigger widget_bookings_enforce_monthly_limit
  before insert on public.widget_bookings
  for each row execute function public.widget_bookings_enforce_monthly_limit();
