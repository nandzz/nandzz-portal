-- ── Per-service staff (segmented bookings) ───────────────────────────────────
--
-- A multi-service booking can now assign a DIFFERENT staff member to each
-- service instead of requiring one person eligible for all of them (the old
-- model blocked any booking whose services had no common staff). Each service
-- becomes a SEGMENT with its own staff + time window:
--   • sequential services take back-to-back slices of the booking;
--   • services flagged `parallel` (owner-controlled, per service) run
--     concurrently and therefore need DISTINCT staff.
--
-- Overlap protection moves from the parent `widget_bookings` row (one staff_id,
-- one range) to `widget_booking_segments`, whose per-segment exclusion
-- constraint reuses the SAME resource-key expression the parent used
-- (coalesce(staff_id, 'loc:' || location_id)) — so every guarantee is preserved
-- while supporting per-service sub-windows. The parent row keeps its aggregate
-- columns unchanged, so notifications / dashboard / revenue read exactly as
-- before.
--
-- Assignment (auto-picking staff for an "any available" choice, and finding a
-- valid distinct-staff assignment across parallel segments) is done in the
-- Next.js route (src/lib/widgets/calendar.ts), which passes fully-resolved
-- segments to the RPCs below; the RPCs are thin transactional writers whose
-- exclusion constraint is the final concurrency arbiter (SLOT_TAKEN on a race).
-- The MCP path (single service, no p_segments) keeps the legacy auto-assign
-- body and simply mirrors one segment.

-- ── 1. widget_booking_segments ──────────────────────────────────────────────
create table if not exists public.widget_booking_segments (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.widget_bookings(id) on delete cascade,
  instance_id   uuid not null references public.widget_instances(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  service_id    text not null,
  service_name  text not null,
  duration_min  int not null,
  price_cents   int,
  parallel      boolean not null default false,
  seq           int not null default 0,        -- order within the booking (0 = primary)
  staff_id      text,                           -- null ⇒ single-resource / unstaffed
  staff_name    text,
  location_id   text,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  status        text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at    timestamptz not null default now()
);

comment on table public.widget_booking_segments is
  'Per-service segment of a widget booking: which staff handles which service, in which sub-window. One row per booked service (>=1 per booking). Overlap for the whole system is enforced here, not on widget_bookings.';

create index if not exists widget_booking_segments_booking on public.widget_booking_segments(booking_id);
create index if not exists widget_booking_segments_avail
  on public.widget_booking_segments(instance_id, starts_at)
  where status = 'confirmed';

alter table public.widget_booking_segments enable row level security;
drop policy if exists "owner_all_widget_booking_segments" on public.widget_booking_segments;
create policy "owner_all_widget_booking_segments" on public.widget_booking_segments
  for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

-- ── 2. Backfill one segment per existing booking ─────────────────────────────
-- Existing bookings used one staff for the whole (summed) block, so a single
-- spanning segment reproduces their occupancy exactly. Status mirrors the parent
-- (cancelled segments are excluded from the constraint, so they never block).
insert into public.widget_booking_segments (
  booking_id, instance_id, owner_user_id, service_id, service_name,
  duration_min, price_cents, parallel, seq, staff_id, staff_name,
  location_id, starts_at, ends_at, status
)
select
  b.id, b.instance_id, b.owner_user_id, b.service_id, b.service_name,
  b.duration_min, b.price_cents, false, 0, b.staff_id, b.staff_name,
  b.location_id, b.starts_at, b.ends_at, b.status
from public.widget_bookings b
where not exists (
  select 1 from public.widget_booking_segments s where s.booking_id = b.id
);

-- ── 3. Exclusion constraint (added AFTER backfill so it validates once) ──────
-- Same resource-key + range shape the parent used, so no confirmed booking that
-- was valid before can now conflict.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'widget_booking_segments_no_overlap'
  ) then
    alter table public.widget_booking_segments
      add constraint widget_booking_segments_no_overlap
      exclude using gist (
        instance_id with =,
        (coalesce(staff_id, 'loc:' || coalesce(location_id, ''))) with =,
        tstzrange(starts_at, ends_at) with &&
      ) where (status = 'confirmed');
  end if;
end;
$$;

-- ── 4. Retire the parent overlap constraint ──────────────────────────────────
-- Overlap now lives entirely on the segments table. Keeping the parent
-- constraint would wrongly reject valid per-service bookings (its single staff_id
-- + whole-range key can't express distinct staff per sub-window).
alter table public.widget_bookings drop constraint if exists widget_bookings_no_overlap;

-- ── 5. Mirror cancellations onto segments ────────────────────────────────────
-- A cancel is a parent status UPDATE (see the /bookings/[token] DELETE route);
-- flip the segments too so their slots free up under the exclusion constraint.
create or replace function public.widget_booking_segments_sync_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status is distinct from OLD.status then
    update public.widget_booking_segments
       set status = NEW.status
     where booking_id = NEW.id and status is distinct from NEW.status;
  end if;
  return NEW;
end;
$$;

drop trigger if exists widget_bookings_sync_segment_status on public.widget_bookings;
create trigger widget_bookings_sync_segment_status
  after update of status on public.widget_bookings
  for each row execute function public.widget_booking_segments_sync_status();

-- ── 6. Helper: place a booking's resolved segments ───────────────────────────
-- Inserts each segment, greedily trying its ordered `staff_ids` candidates and
-- falling through to the next when the exclusion constraint rejects one (a
-- concurrent booking grabbed that person). Raises SLOT_TAKEN when a segment has
-- no free candidate (rolling back the whole enclosing transaction). Returns the
-- chosen assignment as [{seq, service_id, staff_id, staff_name}] so the caller
-- can sync the parent aggregate. `p_segments` element shape:
--   {service_id, name, duration_min, price_cents, parallel, seq, offset_min,
--    staff_ids: [candidate ids...]}   ([] / absent ⇒ unstaffed segment)
create or replace function public._place_booking_segments(
  p_booking_id  uuid,
  p_instance_id uuid,
  p_owner       uuid,
  p_location_id text,
  p_starts_at   timestamptz,
  p_segments    jsonb,
  p_staff_src   jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seg        jsonb;
  v_staff_ids  jsonb;
  v_cand       text;
  v_assigned   text;
  v_assigned_name text;
  v_placed     boolean;
  v_seg_start  timestamptz;
  v_seg_end    timestamptz;
  v_result     jsonb := '[]'::jsonb;
begin
  for v_seg in select value from jsonb_array_elements(p_segments)
  loop
    v_seg_start := p_starts_at + make_interval(mins => (v_seg->>'offset_min')::int);
    v_seg_end   := v_seg_start + make_interval(mins => (v_seg->>'duration_min')::int);
    v_staff_ids := coalesce(v_seg->'staff_ids', '[]'::jsonb);
    v_assigned := null;
    v_assigned_name := null;
    v_placed := false;

    if jsonb_array_length(v_staff_ids) = 0 then
      -- Unstaffed / single-resource segment.
      begin
        insert into public.widget_booking_segments (
          booking_id, instance_id, owner_user_id, service_id, service_name,
          duration_min, price_cents, parallel, seq, staff_id, staff_name,
          location_id, starts_at, ends_at, status
        ) values (
          p_booking_id, p_instance_id, p_owner, v_seg->>'service_id', v_seg->>'name',
          (v_seg->>'duration_min')::int, nullif(v_seg->>'price_cents', '')::int,
          coalesce((v_seg->>'parallel')::boolean, false), (v_seg->>'seq')::int, null, null,
          p_location_id, v_seg_start, v_seg_end, 'confirmed'
        );
        v_placed := true;
      exception when exclusion_violation then
        v_placed := false;
      end;
    else
      for v_cand in select jsonb_array_elements_text(v_staff_ids)
      loop
        v_assigned_name := (
          select s->>'name' from jsonb_array_elements(p_staff_src) s
          where s->>'id' = v_cand limit 1
        );
        begin
          insert into public.widget_booking_segments (
            booking_id, instance_id, owner_user_id, service_id, service_name,
            duration_min, price_cents, parallel, seq, staff_id, staff_name,
            location_id, starts_at, ends_at, status
          ) values (
            p_booking_id, p_instance_id, p_owner, v_seg->>'service_id', v_seg->>'name',
            (v_seg->>'duration_min')::int, nullif(v_seg->>'price_cents', '')::int,
            coalesce((v_seg->>'parallel')::boolean, false), (v_seg->>'seq')::int, v_cand, v_assigned_name,
            p_location_id, v_seg_start, v_seg_end, 'confirmed'
          );
          v_assigned := v_cand;
          v_placed := true;
          exit;
        exception when exclusion_violation then
          continue;  -- that candidate was just taken; try the next
        end;
      end loop;
    end if;

    if not v_placed then
      raise exception 'SLOT_TAKEN' using errcode = 'P0001';
    end if;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'seq', (v_seg->>'seq')::int,
      'service_id', v_seg->>'service_id',
      'staff_id', v_assigned,
      'staff_name', v_assigned_name
    ));
  end loop;

  return v_result;
end;
$$;

revoke all on function public._place_booking_segments(uuid, uuid, uuid, text, timestamptz, jsonb, jsonb) from public;
grant execute on function public._place_booking_segments(uuid, uuid, uuid, text, timestamptz, jsonb, jsonb) to service_role;

-- ── 7. create_booking_tx: add p_segments (new per-service path) ───────────────
-- Drop the current 14-arg signature (20260824150000 + p_locale) before adding
-- the 15th param, so existing named-arg callers (incl. MCP) resolve to the one
-- new function with p_segments defaulting to null (legacy auto-assign path).
drop function if exists public.create_booking_tx(
  uuid, text, timestamptz, text, text, text, text, uuid, text, text, text[], text, text
);

create or replace function public.create_booking_tx(
  p_instance_id     uuid,
  p_service_id      text,
  p_starts_at       timestamptz,
  p_customer_name   text,
  p_customer_email  text,
  p_customer_phone  text default null,
  p_notes           text default null,
  p_created_by      uuid default null,
  p_staff_id        text default null,
  p_location_id     text default null,
  p_service_ids     text[] default null,
  p_customer_address text default null,
  p_locale          text default null,
  p_segments        jsonb default null
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
  v_ids           text[];
  v_id            text;
  v_service     jsonb;
  v_svc_arr     jsonb := '[]'::jsonb;
  v_svc_snapshot jsonb := '[]'::jsonb;
  v_names       text[] := array[]::text[];
  v_duration    int := 0;
  v_svc_dur     int;
  v_svc_price   int;
  v_price       int := null;
  v_service_id  text;
  v_service_name text;
  v_ends_at     timestamptz;
  v_local       timestamp;
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
  v_req_staff   text;
  v_staff       jsonb;
  v_candidates  jsonb := '[]'::jsonb;
  v_cand        jsonb;
  v_locale      text := nullif(trim(coalesce(p_locale, '')), '');
  v_assign      jsonb;
  v_booking     public.widget_bookings%rowtype;
begin
  if trim(coalesce(p_customer_name, '')) = '' then
    raise exception 'MISSING_CUSTOMER' using errcode = 'P0001';
  end if;

  select * into v_instance from public.widget_instances where id = p_instance_id;
  if not found or not v_instance.enabled then
    raise exception 'WIDGET_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if not coalesce(public.user_has_entitlement(v_instance.user_id, 'widgets'), false) then
    raise exception 'NO_ACCESS' using errcode = 'P0001';
  end if;

  v_config := coalesce(v_instance.config, '{}'::jsonb);

  -- Resolve the location subtree (name + staff source) up front for both paths.
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

  -- ════════════════════════════════════════════════════════════════════════
  -- NEW PATH: caller passed a fully-resolved per-service segment plan. The
  -- route already validated availability/eligibility; here we only aggregate,
  -- insert the parent, then place the segments (the exclusion constraint is the
  -- concurrency guard). Used by the public widget /book route.
  -- ════════════════════════════════════════════════════════════════════════
  if p_segments is not null and jsonb_array_length(p_segments) >= 1 then
    -- Aggregate the parent columns from the segment plan (order by seq).
    select
      max((e->>'offset_min')::int + (e->>'duration_min')::int),
      sum(nullif(e->>'price_cents', '')::int),
      array_agg(e->>'name' order by (e->>'seq')::int),
      (select s->>'service_id' from jsonb_array_elements(p_segments) s order by (s->>'seq')::int limit 1)
    into v_duration, v_price, v_names, v_service_id
    from jsonb_array_elements(p_segments) e;

    v_service_name := array_to_string(v_names, ' + ');
    v_ends_at := p_starts_at + make_interval(mins => v_duration);

    insert into public.widget_bookings (
      instance_id, owner_user_id, service_id, service_name, duration_min, price_cents,
      starts_at, ends_at, customer_name, customer_email, customer_phone, customer_address, notes,
      manage_token, created_by_user_id, location_id, location_name, locale
    ) values (
      p_instance_id, v_instance.user_id, v_service_id, v_service_name, v_duration, v_price,
      p_starts_at, v_ends_at, p_customer_name, coalesce(p_customer_email, ''), p_customer_phone, p_customer_address, p_notes,
      encode(extensions.gen_random_bytes(16), 'hex'), p_created_by,
      p_location_id, v_location_name, v_locale
    )
    returning * into v_booking;

    v_assign := public._place_booking_segments(
      v_booking.id, p_instance_id, v_instance.user_id, p_location_id, p_starts_at, p_segments, v_staff_src
    );

    -- Per-service snapshot (with the chosen staff) — stored only for genuine
    -- multi-service bookings, mirroring the single-service legacy rows (null).
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

    -- Sync the parent aggregate staff (the primary/seq-0 assignment) + snapshot.
    update public.widget_bookings
       set staff_id   = (select a->>'staff_id' from jsonb_array_elements(v_assign) a where (a->>'seq')::int = 0 limit 1),
           staff_name = (select a->>'staff_name' from jsonb_array_elements(v_assign) a where (a->>'seq')::int = 0 limit 1),
           services   = v_svc_snapshot
     where id = v_booking.id
     returning * into v_booking;

    return v_booking;
  end if;

  -- ════════════════════════════════════════════════════════════════════════
  -- LEGACY PATH: single p_service_id (or p_service_ids) with server-side
  -- auto-assign. Byte-for-byte the prior behavior, plus one mirror segment so
  -- availability (which reads segments) sees the booking. Used by MCP + manual.
  -- ════════════════════════════════════════════════════════════════════════
  if p_service_ids is not null and array_length(p_service_ids, 1) >= 1 then
    v_ids := p_service_ids;
  else
    v_ids := array[p_service_id];
  end if;

  foreach v_id in array v_ids
  loop
    select elem into v_service
    from jsonb_array_elements(v_services_src) elem
    where elem->>'id' = v_id
    limit 1;
    if v_service is null then
      raise exception 'INVALID_SERVICE' using errcode = 'P0001';
    end if;
    v_svc_dur := coalesce((v_service->>'duration_min')::int, 0);
    if v_svc_dur <= 0 then
      raise exception 'INVALID_SERVICE' using errcode = 'P0001';
    end if;
    v_svc_price := nullif(v_service->>'price_cents', '')::int;
    v_duration := v_duration + v_svc_dur;
    if v_svc_price is not null then
      v_price := coalesce(v_price, 0) + v_svc_price;
    end if;
    v_names := v_names || (v_service->>'name');
    v_svc_arr := v_svc_arr || jsonb_build_array(v_service);
    v_svc_snapshot := v_svc_snapshot || jsonb_build_array(jsonb_build_object(
      'service_id', v_id,
      'name', v_service->>'name',
      'duration_min', v_svc_dur,
      'price_cents', v_svc_price
    ));
  end loop;

  v_service_id   := v_ids[1];
  v_service_name := array_to_string(v_names, ' + ');
  v_ends_at      := p_starts_at + make_interval(mins => v_duration);

  if array_length(v_ids, 1) <= 1 then
    v_svc_snapshot := null;
  end if;

  v_local     := p_starts_at at time zone v_tz;
  v_dow       := v_dow_names[extract(isodow from v_local)::int];
  v_start_min := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;
  v_end_min   := v_start_min + v_duration;
  v_date_str  := to_char(v_local::date, 'YYYY-MM-DD');

  if v_blackout_dates ? v_date_str then
    raise exception 'BLACKOUT' using errcode = 'P0001';
  end if;

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

  -- No staff configured: single-resource insert + one mirror segment.
  if jsonb_array_length(v_staff_all) = 0 then
    begin
      insert into public.widget_bookings (
        instance_id, owner_user_id, service_id, service_name, duration_min, price_cents,
        starts_at, ends_at, customer_name, customer_email, customer_phone, customer_address, notes,
        manage_token, created_by_user_id, location_id, location_name, services, locale
      ) values (
        p_instance_id, v_instance.user_id, v_service_id, v_service_name, v_duration, v_price,
        p_starts_at, v_ends_at, p_customer_name, coalesce(p_customer_email, ''), p_customer_phone, p_customer_address, p_notes,
        encode(extensions.gen_random_bytes(16), 'hex'), p_created_by,
        p_location_id, v_location_name, v_svc_snapshot, v_locale
      )
      returning * into v_booking;

      insert into public.widget_booking_segments (
        booking_id, instance_id, owner_user_id, service_id, service_name,
        duration_min, price_cents, parallel, seq, staff_id, staff_name,
        location_id, starts_at, ends_at, status
      ) values (
        v_booking.id, p_instance_id, v_instance.user_id, v_service_id, v_service_name,
        v_duration, v_price, false, 0, null, null,
        p_location_id, p_starts_at, v_ends_at, 'confirmed'
      );
    exception when exclusion_violation then
      raise exception 'SLOT_TAKEN' using errcode = 'P0001';
    end;

    return v_booking;
  end if;

  -- Staffed: eligible-for-EVERY-service candidates (intersection), then try each.
  v_req_staff := nullif(p_staff_id, '');

  for v_staff in select * from jsonb_array_elements(v_staff_all)
  loop
    if exists (
      select 1
      from jsonb_array_elements(v_svc_arr) svc
      where jsonb_typeof(svc->'staff_ids') = 'array'
        and jsonb_array_length(svc->'staff_ids') > 0
        and not (svc->'staff_ids' ? (v_staff->>'id'))
    ) then
      continue;
    end if;
    if v_req_staff is not null and (v_staff->>'id') <> v_req_staff then
      continue;
    end if;
    if coalesce(v_staff->'blackout_dates', '[]'::jsonb) ? v_date_str then
      continue;
    end if;
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

  for v_cand in select * from jsonb_array_elements(v_candidates)
  loop
    begin
      insert into public.widget_bookings (
        instance_id, owner_user_id, service_id, service_name, duration_min, price_cents,
        starts_at, ends_at, customer_name, customer_email, customer_phone, customer_address, notes,
        manage_token, created_by_user_id, staff_id, staff_name, location_id, location_name, services, locale
      ) values (
        p_instance_id, v_instance.user_id, v_service_id, v_service_name, v_duration, v_price,
        p_starts_at, v_ends_at, p_customer_name, coalesce(p_customer_email, ''), p_customer_phone, p_customer_address, p_notes,
        encode(extensions.gen_random_bytes(16), 'hex'), p_created_by,
        v_cand->>'id', v_cand->>'name', p_location_id, v_location_name, v_svc_snapshot, v_locale
      )
      returning * into v_booking;

      insert into public.widget_booking_segments (
        booking_id, instance_id, owner_user_id, service_id, service_name,
        duration_min, price_cents, parallel, seq, staff_id, staff_name,
        location_id, starts_at, ends_at, status
      ) values (
        v_booking.id, p_instance_id, v_instance.user_id, v_service_id, v_service_name,
        v_duration, v_price, false, 0, v_cand->>'id', v_cand->>'name',
        p_location_id, p_starts_at, v_ends_at, 'confirmed'
      );

      return v_booking;
    exception when exclusion_violation then
      continue;  -- this staff was just taken; roll back + try the next candidate
    end;
  end loop;

  raise exception 'SLOT_TAKEN' using errcode = 'P0001';
end;
$$;

revoke all on function public.create_booking_tx(uuid, text, timestamptz, text, text, text, text, uuid, text, text, text[], text, text, jsonb) from public;
grant execute on function public.create_booking_tx(uuid, text, timestamptz, text, text, text, text, uuid, text, text, text[], text, text, jsonb) to service_role;

-- ── 8. reschedule_booking_tx ──────────────────────────────────────────────────
-- Moves a confirmed booking (by manage_token) to a new start, replacing its
-- segments with a freshly-resolved plan (preserving per-service staff choices,
-- resolved by the route). Deletes the old segments, places the new ones (the
-- exclusion constraint rejects a taken slot → SLOT_TAKEN, rolling back), then
-- updates the parent aggregate ONCE (a single UPDATE, so the reschedule email
-- trigger fires exactly once). `p_actor` drives the notification recipient.
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

-- ── 9. set_booking_segment_staff_tx ───────────────────────────────────────────
-- Owner-only: reassign the staff member responsible for ONE service on a booking
-- WITHOUT moving the time. The exclusion constraint enforces the new staff is
-- free for that segment's window (STAFF_UNAVAILABLE otherwise). Updates the
-- segment + the parent's per-service snapshot; the parent's aggregate staff is
-- synced only when the primary (seq 0) service is reassigned. Sets
-- notify_actor='silent' so the reschedule-email trigger stays quiet — this is an
-- internal reassignment, not a customer-facing reschedule.
create or replace function public.set_booking_segment_staff_tx(
  p_token      text,
  p_service_id text,
  p_staff_id   text
)
returns public.widget_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking   public.widget_bookings%rowtype;
  v_instance  public.widget_instances%rowtype;
  v_config    jsonb;
  v_location  jsonb;
  v_staff_src jsonb;
  v_staff_name text;
  v_seg       public.widget_booking_segments%rowtype;
  v_new_services jsonb;
begin
  select * into v_booking from public.widget_bookings where manage_token = p_token;
  if not found then
    raise exception 'WIDGET_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;

  select * into v_seg from public.widget_booking_segments
   where booking_id = v_booking.id and service_id = p_service_id and status = 'confirmed'
   order by seq limit 1;
  if not found then
    raise exception 'INVALID_SERVICE' using errcode = 'P0001';
  end if;

  -- Resolve the new staff member's display name from the instance config.
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

  v_staff_name := (
    select s->>'name' from jsonb_array_elements(v_staff_src) s where s->>'id' = p_staff_id limit 1
  );
  if v_staff_name is null then
    raise exception 'STAFF_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Move the segment onto the new staff; the exclusion constraint rejects a
  -- clash with that staff's other bookings.
  begin
    update public.widget_booking_segments
       set staff_id = p_staff_id, staff_name = v_staff_name
     where id = v_seg.id;
  exception when exclusion_violation then
    raise exception 'STAFF_UNAVAILABLE' using errcode = 'P0001';
  end;

  -- Reflect the change in the parent's per-service snapshot (multi-service rows).
  if v_booking.services is not null then
    select jsonb_agg(
      case when e->>'service_id' = p_service_id
        then e || jsonb_build_object('staff_id', p_staff_id, 'staff_name', v_staff_name)
        else e end
    )
    into v_new_services
    from jsonb_array_elements(v_booking.services) e;
  else
    v_new_services := v_booking.services;
  end if;

  update public.widget_bookings
     set services = v_new_services,
         staff_id  = case when v_seg.seq = 0 then p_staff_id else staff_id end,
         staff_name = case when v_seg.seq = 0 then v_staff_name else staff_name end,
         notify_actor = 'silent',
         updated_at = now()
   where id = v_booking.id
   returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.set_booking_segment_staff_tx(text, text, text) from public;
grant execute on function public.set_booking_segment_staff_tx(text, text, text) to service_role;

-- ── 10. Silence the reschedule email on internal staff reassignment ───────────
-- Re-issue booking_notify_updated (faithful to 20260824160000) with one guard:
-- notify_actor='silent' suppresses the send. set_booking_segment_staff_tx sets
-- it so a seq-0 reassignment (which touches parent staff_id) doesn't email the
-- customer a misleading "rescheduled" notice.
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
         or NEW.staff_id is distinct from OLD.staff_id) then
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
