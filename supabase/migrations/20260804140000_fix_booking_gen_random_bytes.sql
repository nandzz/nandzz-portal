-- Fix: create_booking_tx failed with 42883 "function gen_random_bytes(integer)
-- does not exist". The function is SECURITY DEFINER with `set search_path =
-- public`, but pgcrypto (which provides gen_random_bytes) is installed in the
-- `extensions` schema on Supabase, so it is not resolvable on that search_path.
-- Schema-qualify the call rather than widening search_path for the whole body.
create or replace function public.create_booking_tx(
  p_instance_id    uuid,
  p_service_id     text,
  p_starts_at      timestamptz,
  p_customer_name  text,
  p_customer_email text,
  p_customer_phone text default null,
  p_notes          text default null,
  p_created_by     uuid default null
)
returns public.widget_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance   public.widget_instances%rowtype;
  v_config     jsonb;
  v_tz         text;
  v_service    jsonb;
  v_duration   int;
  v_ends_at    timestamptz;
  v_local      timestamp;   -- wall-clock time in the owner's tz
  v_dow        text;
  v_dow_names  text[] := array['mon','tue','wed','thu','fri','sat','sun'];
  v_start_min  int;
  v_end_min    int;
  v_window     jsonb;
  v_win_start  int;
  v_win_end    int;
  v_fits       boolean := false;
  v_date_str   text;
  v_booking    public.widget_bookings%rowtype;
begin
  if trim(coalesce(p_customer_name, '')) = '' or trim(coalesce(p_customer_email, '')) = '' then
    raise exception 'MISSING_CUSTOMER' using errcode = 'P0001';
  end if;

  select * into v_instance from public.widget_instances where id = p_instance_id;
  if not found or not v_instance.enabled then
    raise exception 'WIDGET_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if not public.has_widget_access(p_instance_id) then
    raise exception 'NO_ACCESS' using errcode = 'P0001';
  end if;

  v_config := coalesce(v_instance.config, '{}'::jsonb);
  v_tz     := coalesce(nullif(v_config->>'timezone', ''), 'UTC');

  -- Resolve the requested service from config.services.
  select elem into v_service
  from jsonb_array_elements(coalesce(v_config->'services', '[]'::jsonb)) elem
  where elem->>'id' = p_service_id
  limit 1;

  if v_service is null then
    raise exception 'INVALID_SERVICE' using errcode = 'P0001';
  end if;

  v_duration := coalesce((v_service->>'duration_min')::int, 0);
  if v_duration <= 0 then
    raise exception 'INVALID_SERVICE' using errcode = 'P0001';
  end if;
  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  -- Wall-clock local time in the owner's timezone.
  v_local     := p_starts_at at time zone v_tz;
  v_dow       := v_dow_names[extract(isodow from v_local)::int];
  v_start_min := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;
  v_end_min   := v_start_min + v_duration;
  v_date_str  := to_char(v_local::date, 'YYYY-MM-DD');

  -- Blackout dates.
  if coalesce(v_config->'blackout_dates', '[]'::jsonb) ? v_date_str then
    raise exception 'BLACKOUT' using errcode = 'P0001';
  end if;

  -- Must fit fully inside one of the day's availability windows.
  for v_window in
    select * from jsonb_array_elements(coalesce(v_config->'availability'->v_dow, '[]'::jsonb))
  loop
    v_win_start := split_part(v_window->>0, ':', 1)::int * 60 + split_part(v_window->>0, ':', 2)::int;
    v_win_end   := split_part(v_window->>1, ':', 1)::int * 60 + split_part(v_window->>1, ':', 2)::int;
    if v_start_min >= v_win_start and v_end_min <= v_win_end then
      v_fits := true;
      exit;
    end if;
  end loop;

  if not v_fits then
    raise exception 'OUT_OF_HOURS' using errcode = 'P0001';
  end if;

  -- Insert; the exclusion constraint enforces no overlap under concurrency.
  begin
    insert into public.widget_bookings (
      instance_id, owner_user_id, service_id, service_name, duration_min, price_cents,
      starts_at, ends_at, customer_name, customer_email, customer_phone, notes,
      manage_token, created_by_user_id
    ) values (
      p_instance_id, v_instance.user_id, p_service_id, v_service->>'name', v_duration,
      nullif(v_service->>'price_cents', '')::int,
      p_starts_at, v_ends_at, p_customer_name, p_customer_email, p_customer_phone, p_notes,
      encode(extensions.gen_random_bytes(16), 'hex'), p_created_by
    )
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end;

  return v_booking;
end;
$$;

revoke all on function public.create_booking_tx(uuid, text, timestamptz, text, text, text, text, uuid) from public;
grant execute on function public.create_booking_tx(uuid, text, timestamptz, text, text, text, text, uuid) to service_role;
