-- Multi-location ("locales") support for the Calendar & Booking widget.
--
-- Adds an optional location dimension to bookings, mirroring how the staff
-- dimension was added in 20260805130000_widget_staff.sql. Location master
-- data (name, address, photo, timezone, and its own nested services/staff/
-- availability/blackout_dates) lives in the instance `config` jsonb under
-- `locations`, exactly like `staff` does today. Each booking snapshots the
-- location id/name so history survives config edits.
--
-- Concurrency: previously a slot was booked once per staff member (or once
-- for the whole business when unstaffed). With locations, an unstaffed slot
-- must now be booked once *per location* (two shops can hold the same time),
-- while a staffed slot is still keyed on the person (a person can only be in
-- one place at a time, which the location-scoped staff model already
-- enforces structurally — a given staff_id only exists in one location).
-- The exclusion is re-keyed on
-- (instance_id, coalesce(staff_id, 'loc:' || coalesce(location_id, '')), range).
-- Legacy rows (both staff_id and location_id null) collapse to the same
-- single '' bucket as before locations existed, so this applies cleanly to
-- live data with no overlap failures.
--
-- create_booking_tx gains p_location_id (default null = current legacy path,
-- untouched). When provided, it resolves the matching object out of
-- v_config->'locations', raising INVALID_LOCATION if absent, and reads tz
-- (location.timezone, falling back to the business tz), service, business
-- hours/blackout_dates and staff from that location's own subtree instead of
-- the top-level config. p_location_id defaulting to null is what keeps the
-- MCP `book_appointment` edge function (supabase/functions, left untouched
-- per project rule) working unmodified for single-location businesses.

-- ── booking snapshot columns ─────────────────────────────────────────────────
alter table public.widget_bookings add column if not exists location_id   text;
alter table public.widget_bookings add column if not exists location_name text;

-- ── re-key the anti-double-booking exclusion on staff-or-location ───────────
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
        (coalesce(staff_id, 'loc:' || coalesce(location_id, ''))) with =,
        tstzrange(starts_at, ends_at) with &&
      ) where (status = 'confirmed');
  end if;
end;
$$;

-- ── RPC: create_booking_tx (location-aware) ──────────────────────────────────
-- Signature changes (adds p_location_id), so drop the old overload first.
drop function if exists public.create_booking_tx(uuid, text, timestamptz, text, text, text, text, uuid, text);

create or replace function public.create_booking_tx(
  p_instance_id    uuid,
  p_service_id     text,
  p_starts_at      timestamptz,
  p_customer_name  text,
  p_customer_email text,
  p_customer_phone text default null,
  p_notes          text default null,
  p_created_by     uuid default null,
  p_staff_id       text default null,
  p_location_id    text default null
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
  v_location    jsonb;
  v_location_name text;
  v_availability  jsonb;
  v_blackout_dates jsonb;
  v_services_src  jsonb;
  v_staff_src     jsonb;
  v_service     jsonb;
  v_duration    int;
  v_ends_at     timestamptz;
  v_local       timestamp;   -- wall-clock time in the resolved tz
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

  -- Resolve the location subtree (if requested) up front — everything below
  -- reads from it instead of the top-level config when it's present. This is
  -- the ONLY branch point; p_location_id null keeps the exact legacy path.
  if p_location_id is not null then
    select elem into v_location
    from jsonb_array_elements(coalesce(v_config->'locations', '[]'::jsonb)) elem
    where elem->>'id' = p_location_id
    limit 1;

    if v_location is null then
      raise exception 'INVALID_LOCATION' using errcode = 'P0001';
    end if;

    v_location_name  := v_location->>'name';
    v_tz             := coalesce(nullif(v_location->>'timezone', ''), nullif(v_config->>'timezone', ''), 'UTC');
    v_availability   := coalesce(v_location->'availability', '{}'::jsonb);
    v_blackout_dates := coalesce(v_location->'blackout_dates', '[]'::jsonb);
    v_services_src   := coalesce(v_location->'services', '[]'::jsonb);
    v_staff_src      := coalesce(v_location->'staff', '[]'::jsonb);
  else
    v_tz             := coalesce(nullif(v_config->>'timezone', ''), 'UTC');
    v_availability   := coalesce(v_config->'availability', '{}'::jsonb);
    v_blackout_dates := coalesce(v_config->'blackout_dates', '[]'::jsonb);
    v_services_src   := coalesce(v_config->'services', '[]'::jsonb);
    v_staff_src      := coalesce(v_config->'staff', '[]'::jsonb);
  end if;

  -- Resolve the requested service from the resolved services source.
  select elem into v_service
  from jsonb_array_elements(v_services_src) elem
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

  -- Wall-clock local time in the resolved timezone.
  v_local     := p_starts_at at time zone v_tz;
  v_dow       := v_dow_names[extract(isodow from v_local)::int];
  v_start_min := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;
  v_end_min   := v_start_min + v_duration;
  v_date_str  := to_char(v_local::date, 'YYYY-MM-DD');

  -- Business (or location) blackout dates.
  if v_blackout_dates ? v_date_str then
    raise exception 'BLACKOUT' using errcode = 'P0001';
  end if;

  -- Must fit fully inside one of the day's business (or location) hours.
  for v_window in
    select * from jsonb_array_elements(coalesce(v_availability->v_dow, '[]'::jsonb))
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

  v_staff_all := v_staff_src;

  -- ── No staff configured (in the resolved scope): single-resource insert. ───
  if jsonb_array_length(v_staff_all) = 0 then
    begin
      insert into public.widget_bookings (
        instance_id, owner_user_id, service_id, service_name, duration_min, price_cents,
        starts_at, ends_at, customer_name, customer_email, customer_phone, notes,
        manage_token, created_by_user_id, location_id, location_name
      ) values (
        p_instance_id, v_instance.user_id, p_service_id, v_service->>'name', v_duration,
        nullif(v_service->>'price_cents', '')::int,
        p_starts_at, v_ends_at, p_customer_name, p_customer_email, p_customer_phone, p_notes,
        encode(extensions.gen_random_bytes(16), 'hex'), p_created_by,
        p_location_id, v_location_name
      )
      returning * into v_booking;
    exception when exclusion_violation then
      raise exception 'SLOT_TAKEN' using errcode = 'P0001';
    end;

    return v_booking;
  end if;

  -- ── Staffed: build the eligible + available candidate list. ────────────────
  v_svc_staff := v_service->'staff_ids';               -- null/empty ⇒ all staff (in scope)
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
        manage_token, created_by_user_id, staff_id, staff_name, location_id, location_name
      ) values (
        p_instance_id, v_instance.user_id, p_service_id, v_service->>'name', v_duration,
        nullif(v_service->>'price_cents', '')::int,
        p_starts_at, v_ends_at, p_customer_name, p_customer_email, p_customer_phone, p_notes,
        encode(extensions.gen_random_bytes(16), 'hex'), p_created_by,
        v_cand->>'id', v_cand->>'name', p_location_id, v_location_name
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

revoke all on function public.create_booking_tx(uuid, text, timestamptz, text, text, text, text, uuid, text, text) from public;
grant execute on function public.create_booking_tx(uuid, text, timestamptz, text, text, text, text, uuid, text, text) to service_role;
