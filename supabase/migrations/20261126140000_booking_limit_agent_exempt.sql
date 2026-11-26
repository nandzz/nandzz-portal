-- Review fixes for the monthly booking cap (20261126120000).
--
-- 1. WhatsApp-agent bookings are approved by the owner, so they're "from inside"
--    and must not be blocked by the public-link cap. They're stored with
--    created_by_user_id = null (they're the customer's booking), so the trigger
--    can't tell them apart. create_agent_booking_tx wraps create_booking_tx and
--    sets a transaction-local flag the trigger honours. Service-role only, like
--    create_booking_tx; create_booking_tx itself is unchanged.
-- 2. Starter's description still advertised "no Nandzz badge" (badge removed
--    from all profiles) and didn't mention booking.

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
  if coalesce(current_setting('nandzz.booking_limit_exempt', true), '') = 'on' then
    return new; -- owner-approved agent booking (create_agent_booking_tx)
  end if;
  if exists (select 1 from public.booking_limit_status(new.owner_user_id) s where s.reached) then
    raise exception 'BOOKING_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.widget_bookings_enforce_monthly_limit() from public, anon, authenticated;

create or replace function public.create_agent_booking_tx(
  p_instance_id      uuid,
  p_service_id       text,
  p_starts_at        timestamptz,
  p_customer_name    text,
  p_customer_email   text,
  p_customer_phone   text default null,
  p_notes            text default null,
  p_created_by       uuid default null,
  p_staff_id         text default null,
  p_location_id      text default null,
  p_service_ids      text[] default null,
  p_customer_address text default null,
  p_locale           text default null,
  p_segments         jsonb default null
)
returns public.widget_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.widget_bookings;
begin
  perform set_config('nandzz.booking_limit_exempt', 'on', true);
  v_booking := public.create_booking_tx(
    p_instance_id, p_service_id, p_starts_at, p_customer_name, p_customer_email,
    p_customer_phone, p_notes, p_created_by, p_staff_id, p_location_id,
    p_service_ids, p_customer_address, p_locale, p_segments
  );
  perform set_config('nandzz.booking_limit_exempt', '', true);
  return v_booking;
end;
$$;

revoke all on function public.create_agent_booking_tx(uuid, text, timestamptz, text, text, text, text, uuid, text, text, text[], text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_agent_booking_tx(uuid, text, timestamptz, text, text, text, text, uuid, text, text, text[], text, text, jsonb) to service_role;

update public.subscription_plans
   set description = 'Your page, your brand — unlimited spaces, custom style, analytics and online booking.'
 where slug = 'starter'
   and description like '%Nandzz badge%';
