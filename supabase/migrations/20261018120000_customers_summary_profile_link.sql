-- Link booking customers to their Nandzz account.
--
-- A booking made while logged in carries created_by_user_id = the booker. For
-- owner-created (manual) bookings that column holds the OWNER's id, so it only
-- identifies the customer when it differs from owner_user_id. We never match by
-- email: that could attach a stranger's account and would leak whether an email
-- has an account.
--
-- Changes vs 20260828130000:
--   • returns `profile_id` — the booker account from the customer's most recent
--     self-made booking (null when they never booked while logged in);
--   • rollup key falls back to `user:<id>` when a booking has neither email nor
--     phone (emails are optional), so such account bookings still roll up.
-- The return type changes, so the function is dropped and re-granted.

drop function if exists public.widget_customers_summary(uuid, text);

create function public.widget_customers_summary(
  p_instance_id uuid,
  p_location_id text default null
)
returns table (
  id            text,
  email         text,
  name          text,
  phone         text,
  bookings      int,
  upcoming      int,
  cancelled     int,
  revenue_cents bigint,
  last_visit    timestamptz,
  next_visit    timestamptz,
  profile_id    uuid
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not exists (
    select 1 from public.widget_instances wi
    where wi.id = p_instance_id and wi.user_id = auth.uid()
  ) then
    raise exception 'NOT_OWNER' using errcode = '42501';
  end if;

  return query
  with base as (
    select
      coalesce(
        nullif(lower(trim(b.customer_email)), ''),
        'phone:' || nullif(trim(b.customer_phone), ''),
        case when b.created_by_user_id is distinct from b.owner_user_id
             then 'user:' || b.created_by_user_id::text end
      ) as key,
      case when b.created_by_user_id is distinct from b.owner_user_id
           then b.created_by_user_id end as booker_id,
      b.*
    from public.widget_bookings b
    where b.instance_id = p_instance_id
      and b.location_id is not distinct from p_location_id
  ),
  keyed as (
    select * from base where key is not null   -- no email, phone or account ⇒ unattributable
  ),
  contact as (
    select distinct on (key) key, customer_email as email, customer_name as name
    from keyed order by key, created_at desc, keyed.id
  ),
  contact_phone as (
    select distinct on (key) key, customer_phone as phone
    from keyed
    where nullif(trim(customer_phone), '') is not null
    order by key, created_at desc, keyed.id
  ),
  contact_profile as (
    select distinct on (key) key, booker_id
    from keyed
    where booker_id is not null
    order by key, created_at desc, keyed.id
  ),
  agg as (
    select
      key,
      count(*) filter (where status = 'confirmed')                                  as bookings,
      count(*) filter (where status = 'confirmed' and starts_at >= now())           as upcoming,
      count(*) filter (where status = 'cancelled')                                  as cancelled,
      coalesce(sum(price_cents) filter (where status = 'confirmed'), 0)             as revenue_cents,
      max(starts_at) filter (where status = 'confirmed' and starts_at <  now())     as last_visit,
      min(starts_at) filter (where status = 'confirmed' and starts_at >= now())     as next_visit
    from keyed
    group by key
  )
  select
    a.key,
    c.email,
    c.name,
    cp.phone,
    a.bookings::int,
    a.upcoming::int,
    a.cancelled::int,
    a.revenue_cents::bigint,
    a.last_visit,
    a.next_visit,
    pr.booker_id
  from agg a
  join contact c on c.key = a.key
  left join contact_phone cp on cp.key = a.key
  left join contact_profile pr on pr.key = a.key
  order by a.upcoming desc, a.revenue_cents desc, a.bookings desc, c.name asc;
end;
$$;

revoke execute on function public.widget_customers_summary(uuid, text) from public, anon;
grant execute on function public.widget_customers_summary(uuid, text) to authenticated, service_role;
