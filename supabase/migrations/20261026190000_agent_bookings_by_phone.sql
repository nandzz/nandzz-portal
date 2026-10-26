-- Business Agent: a chat's customer is identified by their WhatsApp number
-- (verified by Meta). Their bookings are the ones made in the chat PLUS any
-- booking at the connected calendar whose phone is that number (web form,
-- owner-made). Reschedule/cancel still follow the owner's autonomy settings.
-- One predicate decides it for my_bookings, busy and own_booking.

-- Phone typed anywhere ("+39 333 123 4567", "0039…", "3331234567") vs the
-- WhatsApp id (digits with country code, e.g. 393331234567). A number typed
-- without its country code matches when it is the tail of the WhatsApp id
-- after a 1–3 digit country code; a national trunk 0 (UK 07…) is ignored.
create or replace function agent_private.phone_matches(p_phone text, p_wa_id text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with d as (
    select regexp_replace(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '^00', '') as digits
  ), c as (
    select digits as n from d
    union all
    select substr(digits, 2) from d where digits like '0%'
  )
  select coalesce(bool_or(
    length(n) >= 8 and (
      n = p_wa_id
      or (length(p_wa_id) - length(n) between 1 and 3 and right(p_wa_id, length(n)) = n)
    )
  ), false)
  from c;
$$;

-- Does booking b belong to the customer of thread p_thread?
create or replace function agent_private.is_customer_booking(b public.widget_bookings, p_thread uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select b.agent_thread_id = p_thread or exists (
    select 1
    from public.agent_threads t
    join public.whatsapp_connections c on c.id = t.connection_id
    where t.id = p_thread
      and t.owner_user_id = b.owner_user_id
      and c.widget_instance_id = b.instance_id
      and agent_private.phone_matches(b.customer_phone, t.customer_wa_id)
  );
$$;

create or replace function agent_private.own_booking(p_thread uuid, p_owner uuid, p_booking_id uuid)
returns public.widget_bookings
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  b public.widget_bookings%rowtype;
begin
  select * into b from public.widget_bookings
  where id = p_booking_id and owner_user_id = p_owner;
  if not found or not agent_private.is_customer_booking(b, p_thread) then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;
  return b;
end;
$$;

create or replace function agent_api.my_bookings(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sc record;
begin
  select * into sc from agent_private.resolve_scope(p_token, 'my_bookings');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'booking_id', b.id, 'service', b.service_name, 'service_ids',
      coalesce((select jsonb_agg(x->>'service_id') from jsonb_array_elements(b.services) x), jsonb_build_array(b.service_id)),
      'starts_at', b.starts_at, 'ends_at', b.ends_at,
      'staff', b.staff_name, 'location_id', b.location_id, 'location', b.location_name
    ) order by b.starts_at)
    from public.widget_bookings b
    where b.owner_user_id = sc.owner_user_id
      and b.status = 'confirmed' and b.starts_at > now()
      and agent_private.is_customer_booking(b, sc.thread_id)
  ), '[]'::jsonb);
end;
$$;

create or replace function agent_api.busy(
  p_token text, p_from timestamptz, p_to timestamptz, p_location_id text, p_exclude_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sc record;
begin
  select * into sc from agent_private.resolve_scope(p_token, 'busy');
  if p_to - p_from > interval '62 days' or p_to < p_from then
    raise exception 'INVALID_RANGE' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('staff_id', s.staff_id, 'starts_at', s.starts_at, 'ends_at', s.ends_at))
    from public.widget_booking_segments s
    where s.instance_id = sc.instance_id
      and s.status = 'confirmed'
      and s.starts_at < p_to and s.ends_at > p_from
      and s.location_id is not distinct from p_location_id
      -- Rescheduling: the customer's own booking doesn't block its new time.
      and not exists (
        select 1 from public.widget_bookings b
        where b.id = s.booking_id and b.id = p_exclude_booking_id
          and agent_private.is_customer_booking(b, sc.thread_id)
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function agent_private.phone_matches(text, text) from public, anon, authenticated;
revoke all on function agent_private.is_customer_booking(public.widget_bookings, uuid) from public, anon, authenticated;
