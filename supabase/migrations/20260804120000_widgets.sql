-- Widgets framework + Calendar/Booking widget (first type).
--
-- Concept: "widgets" are interactive tools that live on top of a user's public
-- profile. Each widget *type* lives in `widget_catalog`; a profile owner adds a
-- per-profile *instance* (`widget_instances`) and pays a recurring Stripe
-- subscription (`widget_subscriptions`) to run it. Entitlement to render/accept
-- input is gated on an active subscription via `has_widget_access`.
--
-- The first type is `calendar`: the owner configures services + weekly
-- availability (stored in `widget_instances.config` jsonb); visitors book open
-- slots which land in `widget_bookings`. Double-booking is prevented at the DB
-- level with a gist exclusion constraint; entitlement + availability are
-- enforced in `create_booking_tx` (SECURITY DEFINER).
--
-- Conventions mirror the existing schema: idempotent DDL, RLS on every table,
-- money/entitlement tables have NO client write policy (service-role/RPC only),
-- and the agent_documents owner-all + public-read RLS template.

create extension if not exists pgcrypto;   -- gen_random_bytes for manage tokens
create extension if not exists btree_gist;  -- instance_id (=) + range (&&) exclusion

-- ── shared updated_at trigger ────────────────────────────────────────────────
create or replace function public.widgets_set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.widgets_set_updated_at() from anon, authenticated;

-- ── widget_catalog ───────────────────────────────────────────────────────────
-- One row per widget *type*. Each carries its own recurring Stripe price
-- (created/synced from the admin dashboard), mirroring credit_packs.
create table if not exists public.widget_catalog (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  name              text not null,
  description       text,
  icon              text,                                   -- lucide icon name
  stripe_product_id text,
  stripe_price_id   text,                                   -- a *recurring* price
  price_cents       int not null default 0 check (price_cents >= 0),
  currency          text not null default 'usd',
  billing_interval  text not null default 'month' check (billing_interval in ('month', 'year')),
  active            boolean not null default false,         -- off until Stripe synced
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists widget_catalog_active_sort
  on public.widget_catalog(sort_order)
  where active = true;

alter table public.widget_catalog enable row level security;

drop policy if exists "Active widget types visible to all" on public.widget_catalog;
create policy "Active widget types visible to all"
  on public.widget_catalog for select
  using (active = true);

drop policy if exists "Admins manage widget catalog" on public.widget_catalog;
create policy "Admins manage widget catalog"
  on public.widget_catalog for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop trigger if exists widget_catalog_updated_at on public.widget_catalog;
create trigger widget_catalog_updated_at
  before update on public.widget_catalog
  for each row execute function public.widgets_set_updated_at();

-- Seed the first widget type. Inactive until an admin syncs a recurring Stripe
-- price and flips `active`.
insert into public.widget_catalog (slug, name, description, icon, price_cents, currency, active, sort_order)
values (
  'calendar',
  'Calendar & Booking',
  'Let visitors book appointments directly from your profile. Perfect for salons, clinics, petshops and any service business.',
  'calendar-days',
  900,
  'usd',
  false,
  10
)
on conflict (slug) do nothing;

-- ── widget_instances ─────────────────────────────────────────────────────────
-- One row per (profile, widget type) the owner has added. `config` holds
-- type-specific settings (for calendar: services + weekly availability).
create table if not exists public.widget_instances (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade not null,
  catalog_id  uuid references public.widget_catalog(id) on delete cascade not null,
  enabled     boolean not null default false,
  config      jsonb not null default '{}'::jsonb,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, catalog_id)
);

create index if not exists widget_instances_user
  on public.widget_instances(user_id);

alter table public.widget_instances enable row level security;

-- Owner has full control over their instances.
drop policy if exists "owner_all_widget_instances" on public.widget_instances;
create policy "owner_all_widget_instances" on public.widget_instances
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Anyone (incl. anon) can read enabled instances so the profile can render them.
drop policy if exists "public_read_widget_instances" on public.widget_instances;
create policy "public_read_widget_instances" on public.widget_instances
  for select using (enabled = true);

drop trigger if exists widget_instances_updated_at on public.widget_instances;
create trigger widget_instances_updated_at
  before update on public.widget_instances
  for each row execute function public.widgets_set_updated_at();

-- ── widget_subscriptions ─────────────────────────────────────────────────────
-- Entitlement, one row per instance. Written only by the Stripe webhook via
-- grant_widget_subscription (SECURITY DEFINER). No client write policy.
create table if not exists public.widget_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references public.profiles(id) on delete cascade not null,
  instance_id            uuid references public.widget_instances(id) on delete cascade not null,
  catalog_id             uuid references public.widget_catalog(id) on delete set null,
  stripe_subscription_id text unique,
  stripe_customer_id     text,
  status                 text not null default 'incomplete' check (status in (
                           'active','trialing','past_due','canceled',
                           'incomplete','incomplete_expired','unpaid'
                         )),
  current_period_end     timestamptz,
  stripe_event_id        text,        -- last applied event (reference/debug)
  last_event_at          timestamptz, -- guards against out-of-order events
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (instance_id)
);

create index if not exists widget_subscriptions_instance
  on public.widget_subscriptions(instance_id);

alter table public.widget_subscriptions enable row level security;

drop policy if exists "Users read their own widget subs" on public.widget_subscriptions;
create policy "Users read their own widget subs"
  on public.widget_subscriptions for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );
-- No INSERT/UPDATE/DELETE policy — writes only via SECURITY DEFINER RPC / service role.

drop trigger if exists widget_subscriptions_updated_at on public.widget_subscriptions;
create trigger widget_subscriptions_updated_at
  before update on public.widget_subscriptions
  for each row execute function public.widgets_set_updated_at();

-- ── widget_bookings ──────────────────────────────────────────────────────────
-- Calendar-specific. Inserts go through create_booking_tx (entitlement +
-- availability + overlap). Service fields are denormalized off the instance
-- config at booking time so historical bookings survive config edits.
create table if not exists public.widget_bookings (
  id                 uuid primary key default gen_random_uuid(),
  instance_id        uuid references public.widget_instances(id) on delete cascade not null,
  owner_user_id      uuid references public.profiles(id) on delete cascade not null,
  service_id         text not null,
  service_name       text not null,
  duration_min       int not null check (duration_min > 0),
  price_cents        int,
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  customer_name      text not null,
  customer_email     text not null,
  customer_phone     text,
  notes              text,
  status             text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  manage_token       text unique not null,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists widget_bookings_instance_start
  on public.widget_bookings(instance_id, starts_at)
  where status = 'confirmed';

create index if not exists widget_bookings_owner
  on public.widget_bookings(owner_user_id, starts_at desc);

-- Hard guarantee against double-booking: no two confirmed bookings on the same
-- instance may have overlapping [starts_at, ends_at) ranges.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'widget_bookings_no_overlap'
  ) then
    alter table public.widget_bookings
      add constraint widget_bookings_no_overlap
      exclude using gist (
        instance_id with =,
        tstzrange(starts_at, ends_at) with &&
      ) where (status = 'confirmed');
  end if;
end;
$$;

alter table public.widget_bookings enable row level security;

-- Owner sees/manages every booking on their widgets. Customers (often anon) do
-- NOT get a direct RLS grant — they act through token-scoped API routes that use
-- the service-role client.
drop policy if exists "owner_all_widget_bookings" on public.widget_bookings;
create policy "owner_all_widget_bookings" on public.widget_bookings
  for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

drop trigger if exists widget_bookings_updated_at on public.widget_bookings;
create trigger widget_bookings_updated_at
  before update on public.widget_bookings
  for each row execute function public.widgets_set_updated_at();

-- ── RPC: has_widget_access ───────────────────────────────────────────────────
-- The single entitlement gate. True when the instance has a live subscription.
create or replace function public.has_widget_access(p_instance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.widget_subscriptions ws
    where ws.instance_id = p_instance_id
      and ws.status in ('active', 'trialing')
      and (ws.current_period_end is null or ws.current_period_end > now())
  );
$$;

revoke all on function public.has_widget_access(uuid) from public;
grant execute on function public.has_widget_access(uuid) to authenticated, service_role;

-- ── RPC: create_booking_tx ───────────────────────────────────────────────────
-- Validates the instance is enabled + entitled, resolves the service from the
-- instance config, enforces weekly availability / blackout dates in the owner's
-- timezone, then inserts. Overlap is caught by the exclusion constraint. Raises
-- typed errors: WIDGET_UNAVAILABLE, NO_ACCESS, INVALID_SERVICE, BLACKOUT,
-- OUT_OF_HOURS, SLOT_TAKEN.
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
      encode(gen_random_bytes(16), 'hex'), p_created_by
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

-- ── RPC: grant_widget_subscription ───────────────────────────────────────────
-- Upserts the entitlement row from a Stripe subscription event. Idempotent and
-- order-safe: a staler event (older event.created than the last applied) is
-- ignored. Called only by the webhook (service role).
create or replace function public.grant_widget_subscription(
  p_user_id                uuid,
  p_instance_id            uuid,
  p_catalog_id             uuid,
  p_stripe_subscription_id text,
  p_stripe_customer_id     text,
  p_status                 text,
  p_current_period_end     timestamptz,
  p_stripe_event_id        text,
  p_event_created          timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.widget_subscriptions%rowtype;
begin
  if p_instance_id is null or p_stripe_subscription_id is null then
    raise exception 'missing instance_id or subscription_id' using errcode = 'P0001';
  end if;

  select * into v_existing
  from public.widget_subscriptions
  where stripe_subscription_id = p_stripe_subscription_id
     or instance_id = p_instance_id
  order by (stripe_subscription_id = p_stripe_subscription_id) desc
  limit 1
  for update;

  if found then
    -- Ignore out-of-order deliveries.
    if v_existing.last_event_at is not null
       and p_event_created is not null
       and p_event_created < v_existing.last_event_at then
      return false;
    end if;

    update public.widget_subscriptions set
      user_id                = coalesce(p_user_id, v_existing.user_id),
      instance_id            = p_instance_id,
      catalog_id             = coalesce(p_catalog_id, v_existing.catalog_id),
      stripe_subscription_id = p_stripe_subscription_id,
      stripe_customer_id     = coalesce(p_stripe_customer_id, v_existing.stripe_customer_id),
      status                 = p_status,
      current_period_end     = p_current_period_end,
      stripe_event_id        = p_stripe_event_id,
      last_event_at          = p_event_created
    where id = v_existing.id;
  else
    insert into public.widget_subscriptions (
      user_id, instance_id, catalog_id, stripe_subscription_id, stripe_customer_id,
      status, current_period_end, stripe_event_id, last_event_at
    ) values (
      p_user_id, p_instance_id, p_catalog_id, p_stripe_subscription_id, p_stripe_customer_id,
      p_status, p_current_period_end, p_stripe_event_id, p_event_created
    );
  end if;

  return true;
end;
$$;

revoke all on function public.grant_widget_subscription(uuid, uuid, uuid, text, text, text, timestamptz, text, timestamptz) from public;
grant execute on function public.grant_widget_subscription(uuid, uuid, uuid, text, text, text, timestamptz, text, timestamptz) to service_role;
