-- Reschedule can now also CHANGE the booked services (customer manage page +
-- owner dashboard). reschedule_booking_tx already received the full new segment
-- plan; it now also rewrites the parent's service aggregate columns
-- (service_id = first service, joined service_name, summed duration/price) from
-- that plan, the same way create_booking_tx derives them.
--
-- booking_notify_updated additionally treats a service change as a notifiable
-- "rescheduled" update (a pure service swap at the same time must still email).
-- Body otherwise identical to 20261003120000 (keeps the same-tx created_at guard
-- and the notify_actor='silent' skip).

create or replace function public.reschedule_booking_tx(
  p_token     text,
  p_starts_at timestamptz,
  p_segments  jsonb,
  p_actor     text default 'customer'
)
returns public.widget_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking   public.widget_bookings%rowtype;
  v_instance  public.widget_instances%rowtype;
  v_staff_src jsonb;
  v_config    jsonb;
  v_location  jsonb;
  v_duration  int;
  v_price     int;
  v_names     text[];
  v_service_id text;
  v_ends_at   timestamptz;
  v_assign    jsonb;
  v_svc_snapshot jsonb;
begin
  select * into v_booking from public.widget_bookings where manage_token = p_token;
  if not found then
    raise exception 'WIDGET_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;
  if p_segments is null or jsonb_array_length(p_segments) < 1 then
    raise exception 'INVALID_SERVICE' using errcode = 'P0001';
  end if;

  select * into v_instance from public.widget_instances where id = v_booking.instance_id;
  v_config := coalesce(v_instance.config, '{}'::jsonb);
  if v_booking.location_id is not null then
    select elem into v_location
    from jsonb_array_elements(coalesce(v_config->'locations', '[]'::jsonb)) elem
    where elem->>'id' = v_booking.location_id limit 1;
    v_staff_src := coalesce(v_location->'staff', '[]'::jsonb);
  else
    v_staff_src := coalesce(v_config->'staff', '[]'::jsonb);
  end if;

  select
    max((e->>'offset_min')::int + (e->>'duration_min')::int),
    sum(nullif(e->>'price_cents', '')::int),
    array_agg(e->>'name' order by (e->>'seq')::int),
    (select s->>'service_id' from jsonb_array_elements(p_segments) s order by (s->>'seq')::int limit 1)
  into v_duration, v_price, v_names, v_service_id
  from jsonb_array_elements(p_segments) e;
  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  -- Replace segments first (so the parent UPDATE that fires the email happens
  -- once, after placement succeeds).
  delete from public.widget_booking_segments where booking_id = v_booking.id;
  v_assign := public._place_booking_segments(
    v_booking.id, v_booking.instance_id, v_booking.owner_user_id, v_booking.location_id, p_starts_at, p_segments, v_staff_src
  );

  if jsonb_array_length(p_segments) > 1 then
    select jsonb_agg(
      jsonb_build_object(
        'service_id', e->>'service_id',
        'name', e->>'name',
        'duration_min', (e->>'duration_min')::int,
        'price_cents', nullif(e->>'price_cents', '')::int,
        'parallel', coalesce((e->>'parallel')::boolean, false),
        'staff_id', a->>'staff_id',
        'staff_name', a->>'staff_name'
      ) order by (e->>'seq')::int
    )
    into v_svc_snapshot
    from jsonb_array_elements(p_segments) e
    left join lateral (
      select value a from jsonb_array_elements(v_assign) v(value)
      where (v.value->>'seq')::int = (e->>'seq')::int limit 1
    ) a on true;
  else
    v_svc_snapshot := null;
  end if;

  update public.widget_bookings
     set starts_at = p_starts_at,
         ends_at   = v_ends_at,
         service_id   = v_service_id,
         service_name = array_to_string(v_names, ' + '),
         duration_min = v_duration,
         price_cents  = v_price,
         staff_id  = (select a->>'staff_id' from jsonb_array_elements(v_assign) a where (a->>'seq')::int = 0 limit 1),
         staff_name = (select a->>'staff_name' from jsonb_array_elements(v_assign) a where (a->>'seq')::int = 0 limit 1),
         services  = v_svc_snapshot,
         notify_actor = p_actor
   where id = v_booking.id
   returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.reschedule_booking_tx(text, timestamptz, jsonb, text) from public;
grant execute on function public.reschedule_booking_tx(text, timestamptz, jsonb, text) to service_role;

create or replace function public.booking_notify_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event  text;
  v_url    text;
  v_secret text;
begin
  if OLD.status is distinct from 'cancelled' and NEW.status = 'cancelled' then
    v_event := 'cancelled';
  elsif NEW.status = 'confirmed'
    and (NEW.starts_at is distinct from OLD.starts_at
         or NEW.staff_id is distinct from OLD.staff_id
         or NEW.service_name is distinct from OLD.service_name) then
    -- Row inserted in this same transaction (create_booking_tx syncing the
    -- assigned staff onto the parent): part of the creation, not a reschedule.
    if OLD.created_at = now() then
      return NEW;
    end if;
    v_event := 'rescheduled';
  else
    return NEW;  -- not a notifiable change
  end if;

  -- Internal-only change (e.g. owner reassigned a service's staff): stay quiet.
  if coalesce(NEW.notify_actor, '') = 'silent' then
    return NEW;
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'booking_notify_url' limit 1;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'booking_notify_secret' limit 1;

  if v_url is null then
    return NEW;  -- environment not configured yet: no-op
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-booking-notify-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object(
      'booking_id', NEW.id,
      'event', v_event,
      'actor', coalesce(nullif(NEW.notify_actor, ''), 'customer')
    )
  );

  return NEW;
end;
$$;

-- Also fire on a service_name change (the column list gates the trigger).
drop trigger if exists widget_bookings_notify_updated on public.widget_bookings;
create trigger widget_bookings_notify_updated
  after update of status, starts_at, staff_id, service_name on public.widget_bookings
  for each row execute function public.booking_notify_updated();
