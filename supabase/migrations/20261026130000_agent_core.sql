-- Business Agent, Phase 1 core: the data the agent works on and the agent_api
-- tools that act on it for ONE WhatsApp customer.
--
-- Builds on 20261025120000_agent_runtime_foundation (agent_runtime role, run
-- tokens, agent_private.verify_run_token). Every agent_api function:
--   * verifies the worker's run token for exactly that tool,
--   * resolves the business ONLY from the token's phone_number_id (an active
--     whatsapp_connection) and the customer ONLY from its wa_id,
--   * touches nothing but that business and that customer's own thread and
--     bookings, and returns minimal columns.
-- Owner autonomy (off / pending / confirm) is enforced here, not in the prompt.
--
-- Pending approval does NOT hold the slot: the request is stored and the
-- booking is created when the owner approves (re-checked then).

-- ── Tables ──────────────────────────────────────────────────────────────────

-- The business's WhatsApp number. Embedded Signup will fill this; until then
-- rows are created by hand on dev. The Meta access token will live in Vault.
create table if not exists public.whatsapp_connections (
  id                   uuid primary key default gen_random_uuid(),
  owner_user_id        uuid not null references public.profiles(id) on delete cascade,
  phone_number_id      text not null unique,
  waba_id              text,
  display_phone_number text,
  widget_instance_id   uuid references public.widget_instances(id) on delete set null,
  status               text not null default 'active' check (status in ('active', 'disconnected')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists whatsapp_connections_owner_idx on public.whatsapp_connections (owner_user_id);

-- My Agent → Settings. One row per business.
create table if not exists public.agent_settings (
  owner_user_id      uuid primary key references public.profiles(id) on delete cascade,
  enabled            boolean not null default false,
  agent_name         text not null default 'Assistant' check (length(agent_name) between 1 and 40),
  agent_intro        text not null default '' check (length(agent_intro) <= 200),
  -- Per capability: off | pending | confirm.
  autonomy           jsonb not null default '{"new_booking":"pending","reschedule":"pending","cancel":"pending"}'::jsonb,
  -- null ⇒ around the clock; else weekday → [["HH:MM","HH:MM"], …] like calendar availability.
  agent_hours        jsonb,
  takeover_pause_min int not null default 5 check (takeover_pause_min between 1 and 240),
  updated_at         timestamptz not null default now()
);

-- My Agent → Knowledge. Keyword search for now; embeddings later.
create table if not exists public.agent_knowledge (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  title         text not null check (length(title) between 1 and 200),
  body          text not null check (length(body) between 1 and 8000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists agent_knowledge_owner_idx on public.agent_knowledge (owner_user_id);

-- One thread per (business number, customer).
create table if not exists public.agent_threads (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid not null references public.profiles(id) on delete cascade,
  connection_id   uuid not null references public.whatsapp_connections(id) on delete cascade,
  customer_wa_id  text not null,
  customer_name   text,
  state           text not null default 'agent' check (state in ('agent', 'handed_off')),
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (connection_id, customer_wa_id)
);
create index if not exists agent_threads_owner_idx on public.agent_threads (owner_user_id, last_message_at desc);

create table if not exists public.agent_messages (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null references public.agent_threads(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  -- in = customer, out = agent, owner = typed by the owner on the phone.
  direction     text not null check (direction in ('in', 'out', 'owner')),
  kind          text not null default 'text' check (kind in ('text', 'voice', 'other')),
  body          text not null check (length(body) <= 8000),
  wamid         text,
  created_at    timestamptz not null default now()
);
create index if not exists agent_messages_thread_idx on public.agent_messages (thread_id, created_at);
create unique index if not exists agent_messages_wamid_idx on public.agent_messages (thread_id, wamid) where wamid is not null;

-- My Agent → Activity feed.
create table if not exists public.agent_activity (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  thread_id     uuid references public.agent_threads(id) on delete cascade,
  kind          text not null check (kind in (
                  'booking_created', 'booking_rescheduled', 'booking_cancelled',
                  'approval_requested', 'hand_off')),
  summary       text not null,
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists agent_activity_owner_idx on public.agent_activity (owner_user_id, created_at desc);

-- Requests waiting for the owner (capability = pending). Approval flow later.
create table if not exists public.agent_approvals (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  thread_id     uuid not null references public.agent_threads(id) on delete cascade,
  kind          text not null check (kind in ('new_booking', 'reschedule', 'cancel')),
  booking_id    uuid references public.widget_bookings(id) on delete set null,
  request       jsonb not null,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'failed')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);
create index if not exists agent_approvals_owner_idx on public.agent_approvals (owner_user_id, status, created_at desc);

-- Which chat a booking was made in. The agent may only see/change bookings
-- made in its own chat (never matched by phone or email).
alter table public.widget_bookings
  add column if not exists agent_thread_id uuid references public.agent_threads(id) on delete set null;
create index if not exists widget_bookings_agent_thread_idx on public.widget_bookings (agent_thread_id) where agent_thread_id is not null;

-- ── RLS: owners read their own rows; settings + knowledge are owner-editable.
-- Everything else is written only by agent_api (security definer). ──────────

alter table public.whatsapp_connections enable row level security;
alter table public.agent_settings       enable row level security;
alter table public.agent_knowledge      enable row level security;
alter table public.agent_threads        enable row level security;
alter table public.agent_messages       enable row level security;
alter table public.agent_activity       enable row level security;
alter table public.agent_approvals      enable row level security;

revoke all on public.whatsapp_connections, public.agent_settings, public.agent_knowledge,
  public.agent_threads, public.agent_messages, public.agent_activity, public.agent_approvals
  from anon;
revoke insert, update, delete on public.whatsapp_connections, public.agent_threads,
  public.agent_messages, public.agent_activity, public.agent_approvals
  from authenticated;

create policy whatsapp_connections_owner_select on public.whatsapp_connections
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy agent_threads_owner_select on public.agent_threads
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy agent_messages_owner_select on public.agent_messages
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy agent_activity_owner_select on public.agent_activity
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy agent_approvals_owner_select on public.agent_approvals
  for select to authenticated using (owner_user_id = (select auth.uid()));

create policy agent_settings_owner_all on public.agent_settings
  for all to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));
create policy agent_knowledge_owner_all on public.agent_knowledge
  for all to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

-- ── Scope ───────────────────────────────────────────────────────────────────

-- Verifies the run token for p_tool and resolves who the call is for. Creates
-- the customer's thread on first contact. Raises 'agent_not_connected' when the
-- number isn't an active connection.
create or replace function agent_private.resolve_scope(p_token text, p_tool text)
returns table (
  owner_user_id  uuid,
  connection_id  uuid,
  instance_id    uuid,
  customer_wa_id text,
  thread_id      uuid
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  claims jsonb := agent_private.verify_run_token(p_token, p_tool);
  conn   public.whatsapp_connections%rowtype;
  t_id   uuid;
begin
  select * into conn
  from public.whatsapp_connections c
  where c.phone_number_id = claims->>'phone_number_id' and c.status = 'active';
  if not found then
    raise exception 'agent_not_connected';
  end if;

  insert into public.agent_threads (owner_user_id, connection_id, customer_wa_id)
  values (conn.owner_user_id, conn.id, claims->>'customer_wa_id')
  on conflict (connection_id, customer_wa_id) do nothing;
  select t.id into t_id
  from public.agent_threads t
  where t.connection_id = conn.id and t.customer_wa_id = claims->>'customer_wa_id';

  return query select conn.owner_user_id, conn.id, conn.widget_instance_id, claims->>'customer_wa_id', t_id;
end;
$$;
revoke all on function agent_private.resolve_scope(text, text) from public, anon, authenticated, agent_runtime;

-- off | pending | confirm for one capability; raises when the agent is disabled.
create or replace function agent_private.autonomy(p_owner uuid, p_capability text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.enabled is not true then 'off'
    when s.autonomy->>p_capability in ('off', 'pending', 'confirm') then s.autonomy->>p_capability
    else 'pending'
  end
  from (select 1) one
  left join public.agent_settings s on s.owner_user_id = p_owner
$$;
revoke all on function agent_private.autonomy(uuid, text) from public, anon, authenticated, agent_runtime;

-- The segment plan comes from the worker (resolveSegmentPlan, like the web
-- book route). Check every segment names a real service of this scope with its
-- real duration, so a bad plan can't stretch or invent a booking.
create or replace function agent_private.check_segments(p_config jsonb, p_location_id text, p_segments jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  services jsonb;
  seg      jsonb;
  svc      jsonb;
begin
  if p_segments is null or jsonb_typeof(p_segments) <> 'array'
     or jsonb_array_length(p_segments) < 1 or jsonb_array_length(p_segments) > 10 then
    raise exception 'INVALID_SERVICE' using errcode = 'P0001';
  end if;
  if p_location_id is null then
    services := coalesce(p_config->'services', '[]'::jsonb);
  else
    select coalesce(l->'services', '[]'::jsonb) into services
    from jsonb_array_elements(coalesce(p_config->'locations', '[]'::jsonb)) l
    where l->>'id' = p_location_id;
    if services is null then
      raise exception 'INVALID_LOCATION' using errcode = 'P0001';
    end if;
  end if;
  for seg in select value from jsonb_array_elements(p_segments)
  loop
    select s into svc from jsonb_array_elements(services) s where s->>'id' = seg->>'service_id';
    if svc is null
       or (seg->>'duration_min')::int is distinct from (svc->>'duration_min')::int
       or coalesce((seg->>'offset_min')::int, -1) not between 0 and 1440 then
      raise exception 'INVALID_SERVICE' using errcode = 'P0001';
    end if;
  end loop;
end;
$$;
revoke all on function agent_private.check_segments(jsonb, text, jsonb) from public, anon, authenticated, agent_runtime;

-- The customer's own booking, or raise. Bookings made outside this chat are
-- invisible to the agent.
create or replace function agent_private.own_booking(p_thread uuid, p_owner uuid, p_booking_id uuid)
returns public.widget_bookings
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  b public.widget_bookings%rowtype;
begin
  select * into b from public.widget_bookings
  where id = p_booking_id and agent_thread_id = p_thread and owner_user_id = p_owner;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0001';
  end if;
  return b;
end;
$$;
revoke all on function agent_private.own_booking(uuid, uuid, uuid) from public, anon, authenticated, agent_runtime;

create or replace function agent_private.fmt_when(p_at timestamptz, p_tz text)
returns text
language sql
stable
set search_path = ''
as $$ select to_char(p_at at time zone coalesce(nullif(p_tz, ''), 'UTC'), 'Dy DD Mon HH24:MI') $$;
revoke all on function agent_private.fmt_when(timestamptz, text) from public, anon, authenticated, agent_runtime;

-- ── agent_api tools ─────────────────────────────────────────────────────────

-- Everything the worker needs for one run: business, agent settings, booking
-- config (owner message templates stripped) and the thread state.
create or replace function agent_api.get_context(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sc   record;
  prof record;
  st   public.agent_settings%rowtype;
  cfg  jsonb;
  th   public.agent_threads%rowtype;
begin
  select * into sc from agent_private.resolve_scope(p_token, 'get_context');
  select p.username, p.display_name into prof from public.profiles p where p.id = sc.owner_user_id;
  select * into st from public.agent_settings s where s.owner_user_id = sc.owner_user_id;
  select * into th from public.agent_threads t where t.id = sc.thread_id;

  select wi.config - 'messages' into cfg
  from public.widget_instances wi
  where wi.id = sc.instance_id and wi.user_id = sc.owner_user_id and wi.enabled
    and coalesce(public.user_has_entitlement(wi.user_id, 'widgets'), false);

  return jsonb_build_object(
    'business', jsonb_build_object('name', coalesce(nullif(prof.display_name, ''), prof.username), 'username', prof.username),
    'settings', jsonb_build_object(
      'enabled', coalesce(st.enabled, false),
      'agent_name', coalesce(st.agent_name, 'Assistant'),
      'agent_intro', coalesce(st.agent_intro, ''),
      'autonomy', coalesce(st.autonomy, '{"new_booking":"pending","reschedule":"pending","cancel":"pending"}'::jsonb),
      'agent_hours', st.agent_hours,
      'takeover_pause_min', coalesce(st.takeover_pause_min, 5)
    ),
    -- null ⇒ no bookable widget (disabled or plan without widgets).
    'calendar', cfg,
    'thread', jsonb_build_object('state', th.state, 'first_contact', th.last_message_at is null)
  );
end;
$$;

-- Confirmed segments in a window, for slot computation. Times and staff only.
-- p_exclude_booking_id leaves out one of THIS chat's bookings (reschedule).
create or replace function agent_api.busy(
  p_token text, p_from timestamptz, p_to timestamptz, p_location_id text, p_exclude_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sc record;
begin
  select * into sc from agent_private.resolve_scope(p_token, 'busy');
  if p_to - p_from > interval '62 days' or p_to < p_from then
    raise exception 'INVALID_RANGE' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('staff_id', s.staff_id, 'starts_at', s.starts_at, 'ends_at', s.ends_at))
    from public.widget_booking_segments s
    where s.instance_id = sc.instance_id
      and s.status = 'confirmed'
      and s.starts_at < p_to and s.ends_at > p_from
      and s.location_id is not distinct from p_location_id
      and not exists (
        select 1 from public.widget_bookings b
        where b.id = s.booking_id and b.id = p_exclude_booking_id and b.agent_thread_id = sc.thread_id
      )
  ), '[]'::jsonb);
end;
$$;

-- Best keyword matches first; falls back to the newest entries so the model
-- can still answer when no word matches (small corpora).
create or replace function agent_api.search_knowledge(p_token text, p_query text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sc    record;
  words text[];
begin
  select * into sc from agent_private.resolve_scope(p_token, 'search_knowledge');
  select coalesce(array_agg(distinct w), '{}') into words
  from regexp_split_to_table(lower(left(coalesce(p_query, ''), 500)), '[^[:alnum:]]+') w
  where length(w) > 2;
  return coalesce((
    select jsonb_agg(jsonb_build_object('title', k.title, 'body', k.body) order by k.score desc, k.updated_at desc)
    from (
      select kn.title, kn.body, kn.updated_at,
             (select count(*) from unnest(words) w where lower(kn.title || ' ' || kn.body) like '%' || w || '%') as score
      from public.agent_knowledge kn
      where kn.owner_user_id = sc.owner_user_id
      order by score desc, kn.updated_at desc
      limit 8
    ) k
  ), '[]'::jsonb);
end;
$$;

-- Upcoming bookings made in this chat.
create or replace function agent_api.my_bookings(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sc record;
begin
  select * into sc from agent_private.resolve_scope(p_token, 'my_bookings');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'booking_id', b.id, 'service', b.service_name, 'service_ids',
      coalesce((select jsonb_agg(x->>'service_id') from jsonb_array_elements(b.services) x), jsonb_build_array(b.service_id)),
      'starts_at', b.starts_at, 'ends_at', b.ends_at,
      'staff', b.staff_name, 'location_id', b.location_id, 'location', b.location_name
    ) order by b.starts_at)
    from public.widget_bookings b
    where b.agent_thread_id = sc.thread_id and b.owner_user_id = sc.owner_user_id
      and b.status = 'confirmed' and b.starts_at > now()
  ), '[]'::jsonb);
end;
$$;

-- Book for this chat's customer. p_segments = the worker's resolved plan.
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
    update public.agent_threads set customer_name = name where id = sc.thread_id;
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

-- Move one of this chat's bookings. p_segments = the worker's resolved plan
-- for the new start (same services).
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
  if p_starts_at < now() + interval '30 minutes' or p_starts_at > now() + interval '1 year' then
    raise exception 'OUT_OF_HOURS' using errcode = 'P0001';
  end if;

  select wi.config into cfg from public.widget_instances wi where wi.id = b.instance_id;
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
                   where l->>'id' = b.location_id), wi.config->>'timezone')
  into tz from public.widget_instances wi where wi.id = b.instance_id;

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

-- Pass the chat to the owner. The reason goes to the owner's feed, not logs.
create or replace function agent_api.hand_off(p_token text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sc record;
begin
  select * into sc from agent_private.resolve_scope(p_token, 'hand_off');
  update public.agent_threads set state = 'handed_off' where id = sc.thread_id;
  insert into public.agent_activity (owner_user_id, thread_id, kind, summary)
  values (sc.owner_user_id, sc.thread_id, 'hand_off', left(coalesce(nullif(trim(p_reason), ''), 'Needs a reply'), 300));
  return jsonb_build_object('ok', true);
end;
$$;

-- Store the run's messages. p_messages = [{direction, kind, body, wamid, at}].
create or replace function agent_api.log_messages(p_token text, p_messages jsonb, p_customer_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sc record;
  n  int;
begin
  select * into sc from agent_private.resolve_scope(p_token, 'log_messages');
  if jsonb_typeof(p_messages) <> 'array' or jsonb_array_length(p_messages) > 50 then
    raise exception 'INVALID_MESSAGES' using errcode = 'P0001';
  end if;
  insert into public.agent_messages (thread_id, owner_user_id, direction, kind, body, wamid, created_at)
  select sc.thread_id, sc.owner_user_id, m->>'direction', coalesce(m->>'kind', 'text'),
         left(coalesce(m->>'body', ''), 8000), nullif(m->>'wamid', ''),
         coalesce(to_timestamp((m->>'at')::double precision / 1000), now())
  from jsonb_array_elements(p_messages) m
  on conflict (thread_id, wamid) where wamid is not null do nothing;
  get diagnostics n = row_count;
  update public.agent_threads
     set last_message_at = now(),
         customer_name = coalesce(left(nullif(trim(p_customer_name), ''), 80), customer_name)
   where id = sc.thread_id;
  return jsonb_build_object('stored', n);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'agent_api.get_context(text)',
    'agent_api.busy(text, timestamptz, timestamptz, text, uuid)',
    'agent_api.search_knowledge(text, text)',
    'agent_api.my_bookings(text)',
    'agent_api.create_booking(text, text[], timestamptz, text, text, text, jsonb, text)',
    'agent_api.reschedule_booking(text, uuid, timestamptz, jsonb)',
    'agent_api.cancel_booking(text, uuid)',
    'agent_api.hand_off(text, text)',
    'agent_api.log_messages(text, jsonb, text)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to agent_runtime', f);
  end loop;
end $$;
