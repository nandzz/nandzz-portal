-- The WhatsApp agent follows the business's booking policy (owner settings in
-- the calendar config, see 20261102 web changes):
--   • min_notice_min — earliest start for a new / moved booking (was a fixed
--     30 minutes here); default 60, like the web.
--   • cancel_cutoff_hours — inside this window before the appointment the agent
--     can't cancel or move it: it returns {status:'too_late'} (nothing changed)
--     so the worker tells the customer and offers a hand-off.
-- Bodies are otherwise identical to 20261026130000 (reschedule/cancel) and
-- 20261026210000 (create_booking).

-- Integer setting from the config, clamped; the default when absent/invalid.
create or replace function agent_private.cfg_int(cfg jsonb, k text, lo int, hi int, dflt int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(cfg->k) = 'number' then least(hi, greatest(lo, round((cfg->>k)::numeric)::int))
    else dflt
  end;
$$;

-- Has the customer missed the business's window to change this booking?
create or replace function agent_private.past_cancel_cutoff(cfg jsonb, p_starts_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select now() >= p_starts_at
    - make_interval(hours => agent_private.cfg_int(cfg, 'cancel_cutoff_hours', 0, 168, 0));
$$;

revoke all on function agent_private.cfg_int(jsonb, text, int, int, int) from public, anon, authenticated, agent_runtime;
revoke all on function agent_private.past_cancel_cutoff(jsonb, timestamptz) from public, anon, authenticated, agent_runtime;

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
  if coalesce(array_length(p_service_ids, 1), 0) not between 1 and 10 then
    raise exception 'INVALID_SERVICE' using errcode = 'P0001';
  end if;

  select wi.config into cfg from public.widget_instances wi
  where wi.id = sc.instance_id and wi.user_id = sc.owner_user_id;
  if cfg is null then
    raise exception 'WIDGET_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if p_starts_at < now() + make_interval(mins => agent_private.cfg_int(cfg, 'min_notice_min', 0, 10080, 60))
     or p_starts_at > now() + interval '1 year' then
    raise exception 'OUT_OF_HOURS' using errcode = 'P0001';
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

create or replace function agent_api.reschedule_booking(
  p_token text, p_booking_id uuid, p_starts_at timestamptz, p_segments jsonb
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
  b    public.widget_bookings%rowtype;
  tz   text;
begin
  select * into sc from agent_private.resolve_scope(p_token, 'reschedule_booking');
  b := agent_private.own_booking(sc.thread_id, sc.owner_user_id, p_booking_id);
  if b.status <> 'confirmed' or b.starts_at <= now() then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;
  mode := agent_private.autonomy(sc.owner_user_id, 'reschedule');
  if mode = 'off' then
    return jsonb_build_object('status', 'not_allowed');
  end if;

  select wi.config into cfg from public.widget_instances wi where wi.id = b.instance_id;
  if agent_private.past_cancel_cutoff(cfg, b.starts_at) then
    return jsonb_build_object('status', 'too_late', 'cutoff_hours', agent_private.cfg_int(cfg, 'cancel_cutoff_hours', 0, 168, 0));
  end if;
  if p_starts_at < now() + make_interval(mins => agent_private.cfg_int(cfg, 'min_notice_min', 0, 10080, 60))
     or p_starts_at > now() + interval '1 year' then
    raise exception 'OUT_OF_HOURS' using errcode = 'P0001';
  end if;
  perform agent_private.check_segments(cfg, b.location_id, p_segments);
  tz := coalesce((select l->>'timezone' from jsonb_array_elements(coalesce(cfg->'locations', '[]'::jsonb)) l
                  where l->>'id' = b.location_id), cfg->>'timezone');

  if mode = 'pending' then
    insert into public.agent_approvals (owner_user_id, thread_id, kind, booking_id, request)
    values (sc.owner_user_id, sc.thread_id, 'reschedule', b.id, jsonb_build_object('starts_at', p_starts_at));
    insert into public.agent_activity (owner_user_id, thread_id, kind, summary, data)
    values (sc.owner_user_id, sc.thread_id, 'approval_requested',
      'Move ' || b.service_name || ' to ' || agent_private.fmt_when(p_starts_at, tz),
      jsonb_build_object('kind', 'reschedule', 'booking_id', b.id, 'starts_at', p_starts_at));
    return jsonb_build_object('status', 'pending_owner_approval');
  end if;

  b := public.reschedule_booking_tx(b.manage_token, p_starts_at, p_segments, 'customer');
  insert into public.agent_activity (owner_user_id, thread_id, kind, summary, data)
  values (sc.owner_user_id, sc.thread_id, 'booking_rescheduled',
    b.service_name || ' moved to ' || agent_private.fmt_when(b.starts_at, tz),
    jsonb_build_object('booking_id', b.id));
  return jsonb_build_object('status', 'confirmed', 'booking_id', b.id, 'starts_at', b.starts_at, 'staff', b.staff_name);
end;
$$;

create or replace function agent_api.cancel_booking(p_token text, p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sc   record;
  mode text;
  cfg  jsonb;
  b    public.widget_bookings%rowtype;
  tz   text;
begin
  select * into sc from agent_private.resolve_scope(p_token, 'cancel_booking');
  b := agent_private.own_booking(sc.thread_id, sc.owner_user_id, p_booking_id);
  if b.status <> 'confirmed' or b.starts_at <= now() then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;
  mode := agent_private.autonomy(sc.owner_user_id, 'cancel');
  if mode = 'off' then
    return jsonb_build_object('status', 'not_allowed');
  end if;
  select coalesce((select l->>'timezone' from jsonb_array_elements(coalesce(wi.config->'locations', '[]'::jsonb)) l
                   where l->>'id' = b.location_id), wi.config->>'timezone'), wi.config
  into tz, cfg from public.widget_instances wi where wi.id = b.instance_id;
  if agent_private.past_cancel_cutoff(cfg, b.starts_at) then
    return jsonb_build_object('status', 'too_late', 'cutoff_hours', agent_private.cfg_int(cfg, 'cancel_cutoff_hours', 0, 168, 0));
  end if;

  if mode = 'pending' then
    insert into public.agent_approvals (owner_user_id, thread_id, kind, booking_id, request)
    values (sc.owner_user_id, sc.thread_id, 'cancel', b.id, '{}'::jsonb);
    insert into public.agent_activity (owner_user_id, thread_id, kind, summary, data)
    values (sc.owner_user_id, sc.thread_id, 'approval_requested',
      'Cancel ' || b.service_name || ', ' || agent_private.fmt_when(b.starts_at, tz),
      jsonb_build_object('kind', 'cancel', 'booking_id', b.id));
    return jsonb_build_object('status', 'pending_owner_approval');
  end if;

  -- Same path as the web cancel route: the status change fires the emails.
  update public.widget_bookings set status = 'cancelled', notify_actor = 'customer' where id = b.id;
  insert into public.agent_activity (owner_user_id, thread_id, kind, summary, data)
  values (sc.owner_user_id, sc.thread_id, 'booking_cancelled',
    b.service_name || ', ' || agent_private.fmt_when(b.starts_at, tz),
    jsonb_build_object('booking_id', b.id));
  return jsonb_build_object('status', 'cancelled');
end;
$$;
