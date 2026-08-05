-- Staff / providers for the Calendar & Booking widget.
--
-- Adds an optional staff dimension to bookings. Staff master data (name, photo,
-- info, per-staff weekly availability + days off) lives in the instance
-- `config` jsonb, mirroring how `services` are stored. Each booking snapshots
-- the assigned staff id/name so history survives config edits.
--
-- The core change is concurrency: previously the whole business was ONE
-- resource (exclusion on instance_id + time range). With staff, a time slot can
-- be booked once *per staff member*, so the exclusion is re-keyed on
-- (instance_id, staff_id, range). Bookings with no staff (instances that never
-- configured staff) collapse to a single '' bucket via coalesce, preserving the
-- exact pre-staff behavior. This is not weaker on existing NULL-staff rows, so
-- it applies cleanly to live data with no overlap failures.
--
-- create_booking_tx gains p_staff_id. When staff exist it resolves the eligible
-- + available candidates for the slot and, for "Any available" (null staff),
-- tries each candidate until one inserts — atomic and race-proof.

-- ── booking snapshot columns ─────────────────────────────────────────────────
alter table public.widget_bookings add column if not exists staff_id   text;
alter table public.widget_bookings add column if not exists staff_name text;

-- ── re-key the anti-double-booking exclusion on staff ────────────────────────
alter table public.widget_bookings drop constraint if exists widget_bookings_no_overlap;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'widget_bookings_no_overlap'
  ) then
    alter table public.widget_bookings
      add constraint widget_bookings_no_overlap
      exclude using gist (
        instance_id with =,
        (coalesce(staff_id, '')) with =,
        tstzrange(starts_at, ends_at) with &&
      ) where (status = 'confirmed');
  end if;
end;
$$;

-- ── RPC: create_booking_tx (staff-aware) ─────────────────────────────────────
-- Signature changes (adds p_staff_id), so drop the old overload first.
drop function if exists public.create_booking_tx(uuid, text, timestamptz, text, text, text, text, uuid);

create or replace function public.create_booking_tx(
  p_instance_id    uuid,
  p_service_id     text,
  p_starts_at      timestamptz,
  p_customer_name  text,
  p_customer_email text,
  p_customer_phone text default null,
  p_notes          text default null,
  p_created_by     uuid default null,
  p_staff_id       text default null
)
returns public.widget_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance    public.widget_instances%rowtype;
  v_config      jsonb;
  v_tz          text;
  v_service     jsonb;
  v_duration    int;
  v_ends_at     timestamptz;
  v_local       timestamp;   -- wall-clock time in the owner's tz
  v_dow         text;
  v_dow_names   text[] := array['mon','tue','wed','thu','fri','sat','sun'];
  v_start_min   int;
  v_end_min     int;
  v_window      jsonb;
  v_win_start   int;
  v_win_end     int;
  v_fits        boolean := false;
  v_date_str    text;
  v_staff_all   jsonb;
  v_svc_staff   jsonb;
  v_req_staff   text;
  v_staff       jsonb;
  v_candidates  jsonb := '[]'::jsonb;
  v_cand        jsonb;
  v_booking     public.widget_bookings%rowtype;
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

  -- Business blackout dates.
  if coalesce(v_config->'blackout_dates', '[]'::jsonb) ? v_date_str then
    raise exception 'BLACKOUT' using errcode = 'P0001';
  end if;

  -- Must fit fully inside one of the day's business availability windows.
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

  v_staff_all := coalesce(v_config->'staff', '[]'::jsonb);

  -- ── No staff configured: single-resource insert (legacy behavior). ─────────
  if jsonb_array_length(v_staff_all) = 0 then
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
  end if;

  -- ── Staffed: build the eligible + available candidate list. ────────────────
  v_svc_staff := v_service->'staff_ids';               -- null/empty ⇒ all staff
  v_req_staff := nullif(p_staff_id, '');               -- '' ⇒ "Any available"

  for v_staff in select * from jsonb_array_elements(v_staff_all)
  loop
    -- Service eligibility.
    if v_svc_staff is not null
       and jsonb_typeof(v_svc_staff) = 'array'
       and jsonb_array_length(v_svc_staff) > 0
       and not (v_svc_staff ? (v_staff->>'id')) then
      continue;
    end if;

    -- Specific staff requested ⇒ only that one.
    if v_req_staff is not null and (v_staff->>'id') <> v_req_staff then
      continue;
    end if;

    -- Personal day off.
    if coalesce(v_staff->'blackout_dates', '[]'::jsonb) ? v_date_str then
      continue;
    end if;

    -- Must be working a window covering the slot on this weekday.
    if not exists (
      select 1
      from jsonb_array_elements(coalesce(v_staff->'availability'->v_dow, '[]'::jsonb)) w
      where split_part(w->>0, ':', 1)::int * 60 + split_part(w->>0, ':', 2)::int <= v_start_min
        and v_end_min <= split_part(w->>1, ':', 1)::int * 60 + split_part(w->>1, ':', 2)::int
    ) then
      continue;
    end if;

    v_candidates := v_candidates
      || jsonb_build_array(jsonb_build_object('id', v_staff->>'id', 'name', v_staff->>'name'));
  end loop;

  if jsonb_array_length(v_candidates) = 0 then
    raise exception 'STAFF_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Try each candidate; the exclusion constraint rejects a staff already booked
  -- for an overlapping range, so we fall through to the next free candidate.
  for v_cand in select * from jsonb_array_elements(v_candidates)
  loop
    begin
      insert into public.widget_bookings (
        instance_id, owner_user_id, service_id, service_name, duration_min, price_cents,
        starts_at, ends_at, customer_name, customer_email, customer_phone, notes,
        manage_token, created_by_user_id, staff_id, staff_name
      ) values (
        p_instance_id, v_instance.user_id, p_service_id, v_service->>'name', v_duration,
        nullif(v_service->>'price_cents', '')::int,
        p_starts_at, v_ends_at, p_customer_name, p_customer_email, p_customer_phone, p_notes,
        encode(extensions.gen_random_bytes(16), 'hex'), p_created_by,
        v_cand->>'id', v_cand->>'name'
      )
      returning * into v_booking;

      return v_booking;
    exception when exclusion_violation then
      -- This staff member was just taken for the slot; try the next candidate.
      continue;
    end;
  end loop;

  -- Every eligible candidate is now booked for this slot.
  raise exception 'SLOT_TAKEN' using errcode = 'P0001';
end;
$$;

revoke all on function public.create_booking_tx(uuid, text, timestamptz, text, text, text, text, uuid, text) from public;
grant execute on function public.create_booking_tx(uuid, text, timestamptz, text, text, text, text, uuid, text) to service_role;
