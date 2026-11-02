-- Owner "Extend" on a booking: the client stayed longer (or the owner wants a
-- longer slot), so push the booking's END out by N minutes without moving its
-- start. Unlike reschedule this is an owner override: it ignores opening hours,
-- lead time and "start is in the past" (the appointment is usually under way).
-- The ONLY hard rule is the segments exclusion constraint — the extra time can't
-- overlap the same staff's (or the location's) next booking → SLOT_TAKEN.
--
-- The segments that end last (the final sequential service, or every parallel
-- one sharing that end) are lengthened; the parent's ends_at / duration_min and
-- the multi-service `services` snapshot follow. Price is unchanged.
--
-- Silent by design: booking_notify_updated only fires on status / starts_at /
-- staff_id / service_name, and this touches none of them.
--
-- Called from the owner-only Next route (ownership checked there), so it is
-- service_role-only like the other booking writers.

create or replace function public.extend_booking_tx(
  p_booking_id uuid,
  p_minutes    int
)
returns public.widget_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking  public.widget_bookings%rowtype;
  v_last_end timestamptz;
  v_add      interval;
  v_extended text[];
begin
  if p_minutes is null or p_minutes < 5 or p_minutes > 480 then
    raise exception 'INVALID_DURATION' using errcode = 'P0001';
  end if;
  v_add := make_interval(mins => p_minutes);

  select * into v_booking from public.widget_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'WIDGET_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'BOOKING_CANCELLED' using errcode = 'P0001';
  end if;

  select max(ends_at) into v_last_end
    from public.widget_booking_segments
   where booking_id = v_booking.id and status = 'confirmed';
  if v_last_end is null then
    raise exception 'WIDGET_UNAVAILABLE' using errcode = 'P0001';
  end if;

  begin
    with ext as (
      update public.widget_booking_segments
         set ends_at = ends_at + v_add,
             duration_min = duration_min + p_minutes
       where booking_id = v_booking.id
         and status = 'confirmed'
         and ends_at = v_last_end
      returning service_id
    )
    select array_agg(service_id) into v_extended from ext;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  update public.widget_bookings
     set ends_at = v_last_end + v_add,
         duration_min = duration_min + p_minutes,
         services = case
           when services is null then null
           else (
             select jsonb_agg(
               case when s->>'service_id' = any (v_extended)
                 then jsonb_set(s, '{duration_min}', to_jsonb(coalesce((s->>'duration_min')::int, 0) + p_minutes))
                 else s
               end order by i)
             from jsonb_array_elements(services) with ordinality as t(s, i)
           )
         end
   where id = v_booking.id
   returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.extend_booking_tx(uuid, int) from public;
revoke all on function public.extend_booking_tx(uuid, int) from anon, authenticated;
grant execute on function public.extend_booking_tx(uuid, int) to service_role;
