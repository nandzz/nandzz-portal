-- Widget booking notifications
--
-- 1. `notifications_type_check` (from the initial schema migration) only
--    allowed ('new_comment', 'new_reply', 'comment_mention'). 'ai_edit_ready'
--    is already inserted by src/app/api/webhooks/anthropic/route.ts and was
--    never added — those inserts have been silently failing since
--    createNotification() swallows errors. Widen the constraint to also cover
--    'ai_edit_ready' and the new 'new_booking' type.
--
-- 2. Notify a widget owner whenever a booking is created. Both the public
--    booking API route and the MCP book_appointment tool call
--    create_booking_tx, which ends with a plain INSERT into widget_bookings —
--    so a DB trigger on that table is the one place that covers both call
--    paths without touching either caller (and without touching
--    supabase/functions/mcp/**, out of scope here).

alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('new_comment', 'new_reply', 'comment_mention', 'ai_edit_ready', 'new_booking'));

-- ── notify_owner_new_booking ────────────────────────────────────────────────
-- Fires after a widget_bookings insert and creates an in-app notification for
-- the widget owner. create_booking_tx (the only writer of widget_bookings) is
-- itself SECURITY DEFINER and already relies on definer-privilege RLS bypass
-- to insert into widget_bookings; this trigger runs in that same execution
-- context, so a plain insert here is consistent with existing code.
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
        'starts_at', NEW.starts_at
      )
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists widget_bookings_notify_owner on public.widget_bookings;
create trigger widget_bookings_notify_owner
  after insert on public.widget_bookings
  for each row execute function public.notify_owner_new_booking();
