-- create_booking may be for someone else in the customer's family or circle
-- ("for me and my mother"): the booking carries that person's name, but the
-- chat keeps the name it already has. Only an unnamed chat takes it.
create or replace function agent_api.create_booking(
  p_token text, p_service_ids text[], p_starts_at timestamptz, p_location_id text,
  p_staff_id text, p_customer_name text, p_segments jsonb, p_locale text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sc   record;
  mode text;
  cfg  jsonb;
  tz   text;
  b    public.widget_bookings%rowtype;
  name text := left(nullif(trim(coalesce(p_customer_name, '')), ''), 80);
begin
  select * into sc from agent_private.resolve_scope(p_token, 'create_booking');
  mode := agent_private.autonomy(sc.owner_user_id, 'new_booking');
  if mode = 'off' then
    return jsonb_build_object('status', 'not_allowed');
  end if;
  if p_starts_at < now() + interval '30 minutes' or p_starts_at > now() + interval '1 year' then
    raise exception 'OUT_OF_HOURS' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_service_ids, 1), 0) not between 1 and 10 then
    raise exception 'INVALID_SERVICE' using errcode = 'P0001';
  end if;

  select wi.config into cfg from public.widget_instances wi
  where wi.id = sc.instance_id and wi.user_id = sc.owner_user_id;
  if cfg is null then
    raise exception 'WIDGET_UNAVAILABLE' using errcode = 'P0001';
  end if;
  perform agent_private.check_segments(cfg, p_location_id, p_segments);
  tz := coalesce((select l->>'timezone' from jsonb_array_elements(coalesce(cfg->'locations', '[]'::jsonb)) l
                  where l->>'id' = p_location_id), cfg->>'timezone');

  if name is not null then
    update public.agent_threads set customer_name = name where id = sc.thread_id and customer_name is null;
  end if;

  if mode = 'pending' then
    insert into public.agent_approvals (owner_user_id, thread_id, kind, request)
    values (sc.owner_user_id, sc.thread_id, 'new_booking', jsonb_build_object(
      'service_ids', to_jsonb(p_service_ids), 'starts_at', p_starts_at, 'location_id', p_location_id,
      'staff_id', p_staff_id, 'customer_name', name, 'locale', p_locale));
    insert into public.agent_activity (owner_user_id, thread_id, kind, summary, data)
    values (sc.owner_user_id, sc.thread_id, 'approval_requested',
      'New booking request for ' || agent_private.fmt_when(p_starts_at, tz),
      jsonb_build_object('kind', 'new_booking', 'starts_at', p_starts_at));
    return jsonb_build_object('status', 'pending_owner_approval');
  end if;

  b := public.create_booking_tx(
    p_instance_id    => sc.instance_id,
    p_service_id     => p_service_ids[1],
    p_starts_at      => p_starts_at,
    p_customer_name  => coalesce(name, 'WhatsApp customer'),
    p_customer_email => null,
    p_customer_phone => '+' || sc.customer_wa_id,
    p_staff_id       => nullif(p_staff_id, ''),
    p_location_id    => p_location_id,
    p_service_ids    => p_service_ids,
    p_locale         => p_locale,
    p_segments       => p_segments
  );
  update public.widget_bookings set agent_thread_id = sc.thread_id where id = b.id;
  insert into public.agent_activity (owner_user_id, thread_id, kind, summary, data)
  values (sc.owner_user_id, sc.thread_id, 'booking_created',
    b.service_name || ', ' || agent_private.fmt_when(b.starts_at, tz),
    jsonb_build_object('booking_id', b.id));
  return jsonb_build_object('status', 'confirmed', 'booking_id', b.id, 'service', b.service_name,
    'starts_at', b.starts_at, 'staff', b.staff_name);
end;
$$;
