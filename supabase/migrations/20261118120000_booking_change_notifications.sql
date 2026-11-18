-- In-app notifications for booking cancellations + reschedules
--
-- The owner already gets a `new_booking` notification (bell + live banner) on
-- every confirmed insert. A customer cancelling or rescheduling only produced
-- an email, so the app-wide banner had nothing to show. This adds two types,
-- `booking_cancelled` and `booking_rescheduled`, written by an AFTER UPDATE
-- trigger that mirrors booking_notify_updated()'s event detection.
--
-- Only customer-initiated changes notify: the owner (dashboard = 'business',
-- agent approval = 'owner') made the change themselves, and 'silent' is an
-- internal staff reassignment.
--
-- Every booking notification payload now also carries `timezone` (the booked
-- location's zone, falling back to the calendar's), so the banner and bell
-- show the appointment time where it happens, not in the viewer's zone.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('ai_edit_ready', 'new_booking', 'booking_cancelled', 'booking_rescheduled'));

-- Location timezone for a booking (location → calendar → UTC).
create or replace function public.booking_timezone(p_instance_id uuid, p_location_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif((
      select loc->>'timezone'
        from jsonb_array_elements(coalesce(wi.config->'locations', '[]'::jsonb)) loc
       where loc->>'id' = p_location_id
       limit 1
    ), ''),
    nullif(wi.config->>'timezone', ''),
    'UTC'
  )
  from public.widget_instances wi
  where wi.id = p_instance_id;
$$;

revoke all on function public.booking_timezone(uuid, text) from public, anon, authenticated;

create or replace function public.notify_owner_new_booking()
returns trigger as $$
begin
  if NEW.status = 'confirmed' then
    insert into public.notifications (user_id, type, payload)
    values (
      NEW.owner_user_id,
      'new_booking',
      jsonb_build_object(
        'instance_id', NEW.instance_id,
        'booking_id', NEW.id,
        'customer_name', NEW.customer_name,
        'service_name', NEW.service_name,
        'starts_at', NEW.starts_at,
        'timezone', public.booking_timezone(NEW.instance_id, NEW.location_id)
      )
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.notify_owner_booking_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  if coalesce(nullif(NEW.notify_actor, ''), 'customer') <> 'customer' then
    return NEW;
  end if;

  if OLD.status is distinct from 'cancelled' and NEW.status = 'cancelled' then
    v_type := 'booking_cancelled';
  elsif NEW.status = 'confirmed'
    and (NEW.starts_at is distinct from OLD.starts_at
         or NEW.service_name is distinct from OLD.service_name) then
    -- Same-transaction sync from create_booking_tx: part of the creation.
    if OLD.created_at = now() then
      return NEW;
    end if;
    v_type := 'booking_rescheduled';
  else
    return NEW;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    NEW.owner_user_id,
    v_type,
    jsonb_build_object(
      'instance_id', NEW.instance_id,
      'booking_id', NEW.id,
      'customer_name', NEW.customer_name,
      'service_name', NEW.service_name,
      'starts_at', NEW.starts_at,
      'previous_starts_at', case when v_type = 'booking_rescheduled' and NEW.starts_at is distinct from OLD.starts_at then OLD.starts_at end,
      'timezone', public.booking_timezone(NEW.instance_id, NEW.location_id)
    )
  );
  return NEW;
end;
$$;

revoke execute on function public.notify_owner_booking_changed() from public, anon, authenticated;

drop trigger if exists widget_bookings_notify_owner_changed on public.widget_bookings;
create trigger widget_bookings_notify_owner_changed
  after update of status, starts_at, service_name on public.widget_bookings
  for each row execute function public.notify_owner_booking_changed();
