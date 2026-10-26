-- is_customer_booking must return true/false, never NULL: a booking with no
-- agent_thread_id made `agent_thread_id = p_thread` NULL, and own_booking's
-- `not is_customer_booking(...)` then let the booking through.
create or replace function agent_private.is_customer_booking(b public.widget_bookings, p_thread uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(b.agent_thread_id = p_thread, false) or exists (
    select 1
    from public.agent_threads t
    join public.whatsapp_connections c on c.id = t.connection_id
    where t.id = p_thread
      and t.owner_user_id = b.owner_user_id
      and c.widget_instance_id = b.instance_id
      and agent_private.phone_matches(b.customer_phone, t.customer_wa_id)
  );
$$;

revoke all on function agent_private.is_customer_booking(public.widget_bookings, uuid) from public, anon, authenticated;
