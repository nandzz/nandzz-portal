-- Orders (encomendas), Phase 1: database foundation.
-- Plan: features-doc/orders-plan.md.
--
-- Owners keep a product catalogue and receive orders for a later pickup or
-- delivery (from the WhatsApp agent in Phase 4, or typed in by hand).
--
-- Security model
--   • products / product_images / order_settings: owners write their own rows
--     directly (RLS + CHECK constraints + limit triggers).
--   • orders / order_items / order_events: READ-ONLY for clients. Every write
--     goes through the SECURITY DEFINER RPCs below, so the status machine,
--     stock holds and totals can't be bypassed. Prices always come from the DB.
--   • order_admin_controls: written only by Nandzz admins (service role).
--   • Owner RPCs never take an owner id: owner = auth.uid().
--   • Private helpers live in schema orders_private (not exposed by PostgREST).
--   • Business errors are raised as 'orders:<code>' inside a sub-block and
--     returned as {ok:false, error:<code>}; the sub-block rolls back any stock
--     already held by that call.

create schema if not exists orders_private;
revoke all on schema orders_private from public, anon, authenticated;

-- ── 1. Plans + entitlement ──────────────────────────────────────────────────
alter table public.subscription_plans
  add column if not exists has_orders boolean not null default false,
  add column if not exists orders_product_limit int check (orders_product_limit is null or orders_product_limit >= 0),
  add column if not exists orders_monthly_limit int check (orders_monthly_limit is null or orders_monthly_limit >= 0);

update public.subscription_plans set has_orders = (slug = 'pro');

create or replace function public.user_has_entitlement(p_user_id uuid, p_entitlement text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_entitlement
    when 'widgets'       then sp.has_widgets or p.is_demo
    when 'mcp'           then sp.has_mcp
    when 'analytics'     then sp.has_analytics
    when 'styling'       then sp.has_styling or p.is_demo
    when 'branding'      then sp.hide_branding
    when 'google_review' then sp.has_google_review
    when 'orders'        then sp.has_orders or p.is_demo
    else false
  end
  from public.profiles p
  join public.subscription_plans sp on sp.slug = p.plan_slug
  where p.id = p_user_id;
$$;

revoke all on function public.user_has_entitlement(uuid, text) from public;
grant execute on function public.user_has_entitlement(uuid, text) to authenticated, service_role;

-- ── 2. Platform switches + limits (edited in nandzz-admin) ──────────────────
insert into public.app_settings (key, value, description) values
  ('orders_runtime',
   jsonb_build_object('enabled', true, 'agent_enabled', true),
   'Orders kill switches: enabled=false stops every new order platform-wide; agent_enabled=false stops agent orders only.'),
  ('orders_limits',
   jsonb_build_object(
     'max_images_per_product', 6,
     'max_lines_per_order', 30,
     'max_qty_per_line', 999,
     'max_pending_per_customer', 3,
     'max_pending_expiry_hours', 72,
     'max_days_ahead_cap', 365,
     'customer_emails_per_address_per_day', 10),
   'Orders platform limits, read by the order RPCs and triggers.')
on conflict (key) do nothing;

-- Integer limit from app_settings.orders_limits, clamped; default when absent.
create or replace function orders_private.limit_int(p_key text, p_default int)
returns int
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select case when jsonb_typeof(s.value->p_key) = 'number'
                 then greatest(0, round((s.value->>p_key)::numeric)::int) end
       from public.app_settings s where s.key = 'orders_limits'),
    p_default);
$$;

create or replace function orders_private.runtime_flag(p_key text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select case when jsonb_typeof(s.value->p_key) = 'boolean' then (s.value->>p_key)::boolean end
       from public.app_settings s where s.key = 'orders_runtime'),
    true);
$$;

-- ── 3. Helpers: validation ──────────────────────────────────────────────────
-- Weekly hours: {"mon": [["09:00","13:00"], ["15:00","19:00"]], ...} (same
-- shape as the booking calendar). null / {} = open all day, every day.
create or replace function orders_private.valid_hours(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and not exists (
      select 1 from jsonb_each(p) d
      where d.key not in ('mon','tue','wed','thu','fri','sat','sun')
         or jsonb_typeof(d.value) <> 'array'
         or jsonb_array_length(d.value) > 6
         or exists (
           select 1 from jsonb_array_elements(d.value) r
           where jsonb_typeof(r) <> 'array'
              or jsonb_array_length(r) <> 2
              or coalesce(r->>0, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
              or coalesce(r->>1, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$|^24:00$'
              or (r->>0) >= (r->>1))
    )
  );
$$;

create or replace function orders_private.valid_address(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and octet_length(p::text) <= 2000
    and length(btrim(coalesce(p->>'line1', ''))) between 1 and 200
    and not exists (
      select 1 from jsonb_each(p) e
      where e.key not in ('line1','line2','city','postal_code','notes','lat','lng')
         or (e.key in ('lat','lng') and jsonb_typeof(e.value) not in ('number','null'))
         or (e.key not in ('lat','lng') and jsonb_typeof(e.value) not in ('string','null'))
    )
  );
$$;

create or replace function orders_private.weekday_key(d date)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from d)::int + 1];
$$;

create or replace function orders_private.phone_digits(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^00', ''), '');
$$;

create or replace function orders_private.fail(p_code text, p_detail jsonb default '{}'::jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'orders:' || p_code, detail = p_detail::text;
end;
$$;

-- ── 4. Tables ───────────────────────────────────────────────────────────────
create table if not exists public.order_settings (
  owner_user_id             uuid primary key references public.profiles(id) on delete cascade,
  accepting_orders          boolean not null default false,
  paused_until              date,
  pause_message             text check (length(pause_message) <= 300),
  currency                  text not null default 'eur' check (currency ~ '^[a-z]{3}$'),
  timezone                  text not null default 'UTC' check (length(timezone) between 1 and 64),
  max_orders_per_day        int check (max_orders_per_day is null or max_orders_per_day between 1 and 10000),
  pickup_enabled            boolean not null default true,
  pickup_address            text check (length(pickup_address) <= 300),
  pickup_lat                double precision check (pickup_lat is null or pickup_lat between -90 and 90),
  pickup_lng                double precision check (pickup_lng is null or pickup_lng between -180 and 180),
  pickup_hours              jsonb check (orders_private.valid_hours(pickup_hours)),
  pickup_slot_minutes       int not null default 60 check (pickup_slot_minutes in (0, 15, 30, 60, 120)),
  delivery_enabled          boolean not null default false,
  delivery_fee_cents        int not null default 0 check (delivery_fee_cents between 0 and 10000000),
  free_delivery_over_cents  int check (free_delivery_over_cents is null or free_delivery_over_cents between 0 and 100000000),
  delivery_min_order_cents  int check (delivery_min_order_cents is null or delivery_min_order_cents between 0 and 100000000),
  delivery_area             text check (length(delivery_area) <= 500),
  delivery_hours            jsonb check (orders_private.valid_hours(delivery_hours)),
  delivery_slot_minutes     int not null default 60 check (delivery_slot_minutes in (0, 15, 30, 60, 120)),
  default_lead_time_hours   int not null default 24 check (default_lead_time_hours between 0 and 2160),
  max_days_ahead            int not null default 30 check (max_days_ahead between 1 and 365),
  pending_expiry_hours      int not null default 24 check (pending_expiry_hours between 1 and 720),
  cancel_cutoff_hours       int not null default 24 check (cancel_cutoff_hours between 0 and 720),
  ask_customer_email        text not null default 'optional' check (ask_customer_email in ('never', 'optional', 'required')),
  payment_instructions      text check (length(payment_instructions) <= 1000),
  allergen_note             text check (length(allergen_note) <= 1000),
  cancellation_policy       text check (length(cancellation_policy) <= 1000),
  notify                    jsonb not null default '{}'::jsonb check (jsonb_typeof(notify) = 'object' and octet_length(notify::text) <= 2000),
  category_order            text[] not null default '{}' check (cardinality(category_order) <= 100),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Written by Nandzz admins only (service role). Owners read their own row.
create table if not exists public.order_admin_controls (
  owner_user_id          uuid primary key references public.profiles(id) on delete cascade,
  suspended              boolean not null default false,
  suspended_reason       text check (length(suspended_reason) <= 500),
  comp_until             timestamptz,
  product_limit_override int check (product_limit_override is null or product_limit_override >= 0),
  monthly_limit_override int check (monthly_limit_override is null or monthly_limit_override >= 0),
  updated_by             uuid references public.profiles(id) on delete set null,
  updated_at             timestamptz not null default now()
);

create table if not exists public.products (
  id                   uuid primary key default gen_random_uuid(),
  owner_user_id        uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name                 text not null check (length(btrim(name)) between 1 and 120),
  description          text check (length(description) <= 2000),
  category             text check (length(category) <= 60),
  price_cents          int not null check (price_cents between 0 and 100000000),
  unit_label           text check (length(unit_label) <= 30),
  status               text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  stock_mode           text not null default 'unlimited' check (stock_mode in ('unlimited', 'stock', 'daily')),
  stock_qty            int check (stock_qty is null or stock_qty between 0 and 1000000),
  daily_capacity       int check (daily_capacity is null or daily_capacity between 0 and 100000),
  min_qty              int not null default 1 check (min_qty between 1 and 999),
  max_qty              int check (max_qty is null or max_qty between 1 and 999),
  lead_time_hours      int check (lead_time_hours is null or lead_time_hours between 0 and 2160),
  available_from       date,
  available_until      date,
  fulfilment_weekdays  smallint[] check (fulfilment_weekdays is null or fulfilment_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  sort_order           int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint products_stock_needs_qty check (stock_mode <> 'stock' or stock_qty is not null),
  constraint products_daily_needs_capacity check (stock_mode <> 'daily' or daily_capacity is not null),
  constraint products_qty_range check (max_qty is null or max_qty >= min_qty),
  constraint products_date_range check (available_until is null or available_from is null or available_until >= available_from)
);

create index if not exists products_owner_idx on public.products (owner_user_id, status, sort_order);

create table if not exists public.product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  owner_user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  path          text not null check (length(path) <= 300),
  position      int not null default 0 check (position between 0 and 100),
  width         int check (width is null or width between 1 and 10000),
  height        int check (height is null or height between 1 and 10000),
  created_at    timestamptz not null default now(),
  unique (product_id, path)
);

create index if not exists product_images_product_idx on public.product_images (product_id, position);
create index if not exists product_images_owner_idx on public.product_images (owner_user_id);

create table if not exists public.order_counters (
  owner_user_id uuid primary key references public.profiles(id) on delete cascade,
  last_number   int not null default 0
);

create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  owner_user_id       uuid not null references public.profiles(id) on delete cascade,
  order_number        int not null,
  status              text not null check (status in ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled', 'rejected')),
  source              text not null check (source in ('agent', 'manual')),
  customer_name       text not null check (length(btrim(customer_name)) between 1 and 120),
  customer_phone      text check (length(customer_phone) <= 32),
  customer_email      text check (length(customer_email) <= 254 and customer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  customer_locale     text check (length(customer_locale) <= 10),
  customer_user_id    uuid references public.profiles(id) on delete set null,
  agent_thread_id     uuid references public.agent_threads(id) on delete set null,
  fulfilment_method   text not null check (fulfilment_method in ('pickup', 'delivery')),
  fulfil_on           date not null,
  fulfil_from         time,
  fulfil_to           time,
  delivery_address    jsonb check (orders_private.valid_address(delivery_address)),
  currency            text not null check (currency ~ '^[a-z]{3}$'),
  subtotal_cents      bigint not null check (subtotal_cents >= 0),
  delivery_fee_cents  bigint not null default 0 check (delivery_fee_cents >= 0),
  total_cents         bigint not null check (total_cents >= 0),
  payment_status      text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded', 'partially_refunded')),
  payment_method      text check (payment_method in ('cash', 'card_in_person', 'bank_transfer', 'online')),
  paid_at             timestamptz,
  amount_paid_cents   bigint check (amount_paid_cents is null or amount_paid_cents >= 0),
  customer_note       text check (length(customer_note) <= 1000),
  internal_note       text check (length(internal_note) <= 2000),
  cancel_reason       text check (length(cancel_reason) <= 300),
  client_request_id   text check (length(client_request_id) <= 120),
  expires_at          timestamptz,
  confirmed_at        timestamptz,
  ready_at            timestamptz,
  completed_at        timestamptz,
  cancelled_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (owner_user_id, order_number),
  constraint orders_delivery_needs_address check (fulfilment_method <> 'delivery' or delivery_address is not null),
  constraint orders_window check (fulfil_to is null or fulfil_from is null or fulfil_to > fulfil_from),
  constraint orders_contact check (customer_phone is not null or customer_email is not null or source = 'manual')
);

create unique index if not exists orders_request_uidx on public.orders (owner_user_id, client_request_id) where client_request_id is not null;
create index if not exists orders_owner_day_idx on public.orders (owner_user_id, fulfil_on);
create index if not exists orders_owner_status_idx on public.orders (owner_user_id, status, created_at desc);
create index if not exists orders_owner_created_idx on public.orders (owner_user_id, created_at);
create index if not exists orders_pending_expiry_idx on public.orders (expires_at) where status = 'pending';
create index if not exists orders_thread_idx on public.orders (agent_thread_id) where agent_thread_id is not null;
create index if not exists orders_customer_user_idx on public.orders (customer_user_id) where customer_user_id is not null;

create table if not exists public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  owner_user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id       uuid references public.products(id) on delete set null,
  name             text not null check (length(name) between 1 and 120),
  unit_label       text check (length(unit_label) <= 30),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  quantity         int not null check (quantity between 1 and 100000),
  line_total_cents bigint not null check (line_total_cents >= 0),
  note             text check (length(note) <= 300),
  position         int not null default 0
);

create index if not exists order_items_order_idx on public.order_items (order_id, position);
create index if not exists order_items_product_idx on public.order_items (product_id) where product_id is not null;
create index if not exists order_items_owner_idx on public.order_items (owner_user_id);

create table if not exists public.order_events (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  actor         text not null check (actor in ('owner', 'agent', 'customer', 'system')),
  type          text not null check (type in ('created', 'status', 'edited', 'items', 'payment', 'note')),
  from_status   text,
  to_status     text,
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists order_events_order_idx on public.order_events (order_id, created_at);
create index if not exists order_events_owner_idx on public.order_events (owner_user_id);

-- ── 5. RLS + grants ─────────────────────────────────────────────────────────
alter table public.order_settings       enable row level security;
alter table public.order_admin_controls enable row level security;
alter table public.products             enable row level security;
alter table public.product_images       enable row level security;
alter table public.order_counters       enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_events         enable row level security;

revoke all on public.order_settings, public.order_admin_controls, public.products, public.product_images,
              public.order_counters, public.orders, public.order_items, public.order_events
  from anon;
-- Read-only for signed-in clients; writes go through RPCs / service role.
revoke insert, update, delete, truncate on public.order_admin_controls, public.order_counters,
              public.orders, public.order_items, public.order_events
  from authenticated;
revoke select on public.order_counters from authenticated;
revoke delete, truncate on public.order_settings from authenticated;

drop policy if exists order_settings_owner_select on public.order_settings;
create policy order_settings_owner_select on public.order_settings
  for select to authenticated using (owner_user_id = (select auth.uid()));
drop policy if exists order_settings_owner_insert on public.order_settings;
create policy order_settings_owner_insert on public.order_settings
  for insert to authenticated with check (owner_user_id = (select auth.uid()));
drop policy if exists order_settings_owner_update on public.order_settings;
create policy order_settings_owner_update on public.order_settings
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

drop policy if exists order_admin_controls_owner_select on public.order_admin_controls;
create policy order_admin_controls_owner_select on public.order_admin_controls
  for select to authenticated using (owner_user_id = (select auth.uid()));

drop policy if exists products_owner_all on public.products;
create policy products_owner_all on public.products
  for all to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

drop policy if exists product_images_owner_all on public.product_images;
create policy product_images_owner_all on public.product_images
  for all to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (
    owner_user_id = (select auth.uid())
    and exists (select 1 from public.products p
                 where p.id = product_id and p.owner_user_id = (select auth.uid()))
    and path like (select auth.uid())::text || '/' || product_id::text || '/%'
    and path !~ '\.\.'
  );

drop policy if exists orders_owner_select on public.orders;
create policy orders_owner_select on public.orders
  for select to authenticated using (owner_user_id = (select auth.uid()));
drop policy if exists order_items_owner_select on public.order_items;
create policy order_items_owner_select on public.order_items
  for select to authenticated using (owner_user_id = (select auth.uid()));
drop policy if exists order_events_owner_select on public.order_events;
create policy order_events_owner_select on public.order_events
  for select to authenticated using (owner_user_id = (select auth.uid()));

-- ── 6. Triggers on owner-written tables ─────────────────────────────────────
create or replace function orders_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists order_settings_touch on public.order_settings;
create trigger order_settings_touch before update on public.order_settings
  for each row execute function orders_private.touch_updated_at();
drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function orders_private.touch_updated_at();

-- Owner id can never change; the timezone must be a real IANA zone.
create or replace function orders_private.guard_order_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.owner_user_id <> old.owner_user_id then
    raise exception 'owner_user_id is immutable';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'invalid timezone %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists order_settings_guard on public.order_settings;
create trigger order_settings_guard before insert or update on public.order_settings
  for each row execute function orders_private.guard_order_settings();

-- Effective product limit: admin override → plan → unlimited.
create or replace function orders_private.product_limit(p_owner uuid)
returns int
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select c.product_limit_override from public.order_admin_controls c where c.owner_user_id = p_owner),
    (select sp.orders_product_limit from public.profiles p
       join public.subscription_plans sp on sp.slug = p.plan_slug where p.id = p_owner));
$$;

create or replace function orders_private.guard_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lim int;
begin
  if tg_op = 'UPDATE' and new.owner_user_id <> old.owner_user_id then
    raise exception 'owner_user_id is immutable';
  end if;
  if new.status <> 'archived' and (tg_op = 'INSERT' or old.status = 'archived') then
    lim := orders_private.product_limit(new.owner_user_id);
    if lim is not null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('products:' || new.owner_user_id::text, 0));
      if (select count(*) from public.products p
           where p.owner_user_id = new.owner_user_id and p.status <> 'archived' and p.id <> new.id) >= lim then
        raise exception 'orders:product_limit' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists products_guard on public.products;
create trigger products_guard before insert or update on public.products
  for each row execute function orders_private.guard_product();

create or replace function orders_private.guard_product_image()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.owner_user_id <> old.owner_user_id or new.product_id <> old.product_id or new.path <> old.path) then
    raise exception 'product image owner, product and path are immutable';
  end if;
  if tg_op = 'INSERT' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('product_images:' || new.product_id::text, 0));
    if (select count(*) from public.product_images i where i.product_id = new.product_id)
       >= orders_private.limit_int('max_images_per_product', 6) then
      raise exception 'orders:image_limit' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists product_images_guard on public.product_images;
create trigger product_images_guard before insert or update on public.product_images
  for each row execute function orders_private.guard_product_image();

-- ── 7. Storage: product-images bucket ───────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners can read their own product-images" on storage.objects;
create policy "Owners can read their own product-images" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Owners can upload product-images" on storage.objects;
create policy "Owners can upload product-images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Owners can update product-images" on storage.objects;
create policy "Owners can update product-images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Owners can delete product-images" on storage.objects;
create policy "Owners can delete product-images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ── 8. Order core ───────────────────────────────────────────────────────────
-- Why this owner can't take an order right now, or null. Manual orders
-- (p_rules = false) ignore the owner's own pause/accepting switch.
create or replace function orders_private.blocked_reason(p_owner uuid, p_rules boolean, p_source text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  s      public.order_settings%rowtype;
  ac     public.order_admin_controls%rowtype;
  has_ac boolean;
begin
  if not orders_private.runtime_flag('enabled') then return 'orders_disabled'; end if;
  if p_source = 'agent' and not orders_private.runtime_flag('agent_enabled') then return 'orders_disabled'; end if;
  select * into ac from public.order_admin_controls where owner_user_id = p_owner;
  has_ac := found;
  if has_ac and ac.suspended then return 'suspended'; end if;
  if not (coalesce(public.user_has_entitlement(p_owner, 'orders'), false)
          or (has_ac and coalesce(ac.comp_until > now(), false))) then
    return 'not_entitled';
  end if;
  select * into s from public.order_settings where owner_user_id = p_owner;
  if not found then return 'not_set_up'; end if;
  if p_rules then
    if not s.accepting_orders then return 'not_accepting'; end if;
    if s.paused_until is not null and s.paused_until >= (now() at time zone s.timezone)::date then
      return 'paused';
    end if;
  end if;
  return null;
end;
$$;

-- Monthly order limit: admin override → plan → unlimited (UTC month).
create or replace function orders_private.check_monthly_limit(p_owner uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  lim int;
begin
  lim := coalesce(
    (select c.monthly_limit_override from public.order_admin_controls c where c.owner_user_id = p_owner),
    (select sp.orders_monthly_limit from public.profiles p
       join public.subscription_plans sp on sp.slug = p.plan_slug where p.id = p_owner));
  if lim is not null and (
       select count(*) from public.orders o
        where o.owner_user_id = p_owner
          and o.created_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC') >= lim then
    perform orders_private.fail('monthly_limit');
  end if;
end;
$$;

-- Does [from, to] (or the whole day when from is null) fit the weekday's hours?
create or replace function orders_private.fits_hours(p_hours jsonb, p_day date, p_from time, p_to time)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_hours is null or p_hours = '{}'::jsonb then true
    when not (p_hours ? orders_private.weekday_key(p_day)) then false
    when jsonb_array_length(p_hours->orders_private.weekday_key(p_day)) = 0 then false
    when p_from is null then true
    else exists (
      select 1 from jsonb_array_elements(p_hours->orders_private.weekday_key(p_day)) r
      where p_from >= (r->>0)::time
        and coalesce(p_to, p_from) <= case when r->>1 = '24:00' then '23:59:59'::time else (r->>1)::time end)
  end;
$$;

-- Last closing time of the day (for the lead-time check when no time is set).
create or replace function orders_private.day_close(p_hours jsonb, p_day date)
returns time
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select max(case when r->>1 = '24:00' then '23:59:59'::time else (r->>1)::time end)
       from jsonb_array_elements(coalesce(p_hours->orders_private.weekday_key(p_day), '[]'::jsonb)) r),
    '23:59:59'::time);
$$;

-- Hold stock for one product line. Stock mode: atomic conditional decrement.
-- Daily mode: capacity per fulfilment day, serialised by an advisory lock.
-- p_enforce_daily = false lets the owner knowingly go over their own capacity.
create or replace function orders_private.hold_stock(p_product public.products, p_qty int, p_day date, p_enforce_daily boolean)
returns void
language plpgsql
set search_path = ''
as $$
declare
  used bigint;
begin
  if p_product.stock_mode = 'stock' then
    update public.products set stock_qty = stock_qty - p_qty
     where id = p_product.id and stock_qty >= p_qty;
    if not found then
      perform orders_private.fail('sold_out', jsonb_build_object('product_id', p_product.id,
        'available', (select stock_qty from public.products where id = p_product.id)));
    end if;
  elsif p_product.stock_mode = 'daily' and p_enforce_daily then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('daily:' || p_product.id::text || ':' || p_day::text, 0));
    select coalesce(sum(i.quantity), 0) into used
      from public.order_items i
      join public.orders o on o.id = i.order_id
     where i.product_id = p_product.id
       and o.fulfil_on = p_day
       and o.status not in ('cancelled', 'rejected');
    if used + p_qty > p_product.daily_capacity then
      perform orders_private.fail('sold_out', jsonb_build_object('product_id', p_product.id,
        'available', greatest(0, p_product.daily_capacity - used), 'date', p_day));
    end if;
  end if;
end;
$$;

-- Give back the stock held by an order's lines (stock mode only; daily
-- capacity frees itself because cancelled/rejected orders aren't counted).
create or replace function orders_private.release_stock(p_order_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.products p
     set stock_qty = least(1000000, p.stock_qty + x.qty)
    from (select i.product_id, sum(i.quantity) as qty
            from public.order_items i
           where i.order_id = p_order_id and i.product_id is not null
           group by i.product_id) x
   where p.id = x.product_id and p.stock_mode = 'stock' and p.stock_qty is not null;
$$;

-- Validate + price + hold stock for a list of lines, then insert them.
-- Returns the subtotal. Raises orders:* on any problem.
create or replace function orders_private.write_items(
  p_order_id uuid, p_owner uuid, p_items jsonb, p_day date, p_rules boolean, p_now_local timestamp,
  p_settings public.order_settings, p_lead_ref time
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  it        jsonb;
  idx       bigint;
  pid       uuid;
  qn        numeric;
  qty       int;
  note      text;
  pr        public.products%rowtype;
  subtotal  bigint := 0;
  line      bigint;
  max_lines int := orders_private.limit_int('max_lines_per_order', 30);
  max_qty   int := orders_private.limit_int('max_qty_per_line', 999);
  lead      int;
  ready_at  timestamp;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform orders_private.fail('no_items');
  end if;
  if jsonb_array_length(p_items) > max_lines then
    perform orders_private.fail('too_many_lines', jsonb_build_object('max', max_lines));
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e where jsonb_typeof(e) <> 'object') then
    perform orders_private.fail('bad_request');
  end if;
  -- the same product twice would dodge per-line limits
  if (select count(distinct e->>'product_id') from jsonb_array_elements(p_items) e) <> jsonb_array_length(p_items) then
    perform orders_private.fail('duplicate_product');
  end if;

  -- Lines are locked in product-id order so two orders never deadlock; the
  -- original order is kept in order_items.position.
  for it, idx in
    select e.value, e.ord from jsonb_array_elements(p_items) with ordinality e(value, ord)
     order by e.value->>'product_id'
  loop
    begin
      pid := (it->>'product_id')::uuid;
    exception when others then
      perform orders_private.fail('unknown_product', jsonb_build_object('product_id', it->>'product_id'));
    end;
    if coalesce(jsonb_typeof(it->'quantity'), '') <> 'number' then
      perform orders_private.fail('bad_quantity', jsonb_build_object('product_id', pid));
    end if;
    qn := (it->>'quantity')::numeric;
    if qn <> trunc(qn) or qn < 1 or qn > max_qty then
      perform orders_private.fail('bad_quantity', jsonb_build_object('product_id', pid, 'max', max_qty));
    end if;
    qty := qn::int;
    note := nullif(btrim(coalesce(it->>'note', '')), '');
    if note is not null and length(note) > 300 then
      perform orders_private.fail('note_too_long', jsonb_build_object('product_id', pid));
    end if;

    select * into pr from public.products where id = pid and owner_user_id = p_owner for update;
    if not found or pr.status = 'archived' or (p_rules and pr.status <> 'active') then
      perform orders_private.fail('unknown_product', jsonb_build_object('product_id', pid));
    end if;
    if (p_rules and (qty < pr.min_qty or (pr.max_qty is not null and qty > pr.max_qty))) then
      perform orders_private.fail('bad_quantity', jsonb_build_object('product_id', pid,
        'min', pr.min_qty, 'max', least(coalesce(pr.max_qty, max_qty), max_qty)));
    end if;

    if p_rules then
      if (pr.available_from is not null and p_day < pr.available_from)
         or (pr.available_until is not null and p_day > pr.available_until)
         or (pr.fulfilment_weekdays is not null and not (extract(dow from p_day)::smallint = any (pr.fulfilment_weekdays))) then
        perform orders_private.fail('product_unavailable_on_day', jsonb_build_object('product_id', pid, 'date', p_day));
      end if;
      lead := coalesce(pr.lead_time_hours, p_settings.default_lead_time_hours);
      ready_at := p_day + coalesce(p_lead_ref, '23:59:59'::time);
      if ready_at < p_now_local + make_interval(hours => lead) then
        perform orders_private.fail('too_soon', jsonb_build_object('product_id', pid, 'lead_time_hours', lead));
      end if;
    end if;

    perform orders_private.hold_stock(pr, qty, p_day, p_rules);

    line := pr.price_cents::bigint * qty;
    subtotal := subtotal + line;
    insert into public.order_items (order_id, owner_user_id, product_id, name, unit_label, unit_price_cents, quantity, line_total_cents, note, position)
    values (p_order_id, p_owner, pr.id, pr.name, pr.unit_label, pr.price_cents, qty, line, note, idx::int - 1);
  end loop;

  return subtotal;
end;
$$;

-- The one place an order is created.
--   p_rules  = true  → agent: every scheduling/limit rule of the owner applies.
--   p_rules  = false → owner's manual order: the owner may override their own
--                      scheduling rules; platform limits and stock still apply.
create or replace function orders_private.create_order(
  p_owner uuid, p_payload jsonb, p_source text, p_actor text, p_rules boolean, p_status text
)
returns public.orders
language plpgsql
set search_path = ''
as $$
declare
  s          public.order_settings%rowtype;
  o          public.orders%rowtype;
  reason     text;
  method     text := p_payload->>'fulfilment_method';
  day        date;
  t_from     time;
  t_to       time;
  addr       jsonb := nullif(p_payload->'delivery_address', 'null'::jsonb);
  now_local  timestamp;
  num        int;
  subtotal   bigint;
  fee        bigint := 0;
  req_id     text := nullif(btrim(coalesce(p_payload->>'client_request_id', '')), '');
  phone      text := nullif(btrim(coalesce(p_payload->>'customer_phone', '')), '');
  hours      jsonb;
  expiry_h   int;
  lead_ref   time;
  cname      text := btrim(coalesce(p_payload->>'customer_name', ''));
  cemail     text := lower(nullif(btrim(coalesce(p_payload->>'customer_email', '')), ''));
  cnote      text := nullif(btrim(coalesce(p_payload->>'customer_note', '')), '');
begin
  -- Idempotency: a retried request returns the order it already created.
  if req_id is not null then
    select * into o from public.orders where owner_user_id = p_owner and client_request_id = req_id;
    if found then return o; end if;
  end if;

  reason := orders_private.blocked_reason(p_owner, p_rules, p_source);
  if reason is not null then perform orders_private.fail(reason); end if;
  select * into s from public.order_settings where owner_user_id = p_owner;
  now_local := now() at time zone s.timezone;

  perform orders_private.check_monthly_limit(p_owner);

  if method not in ('pickup', 'delivery') then perform orders_private.fail('bad_method'); end if;
  begin
    day    := (p_payload->>'fulfil_on')::date;
    t_from := nullif(p_payload->>'fulfil_from', '')::time;
    t_to   := nullif(p_payload->>'fulfil_to', '')::time;
  exception when others then
    perform orders_private.fail('bad_date');
  end;
  if day is null or (t_to is not null and (t_from is null or t_to <= t_from)) then
    perform orders_private.fail('bad_date');
  end if;
  if method = 'delivery' then
    if addr is null or not orders_private.valid_address(addr) then perform orders_private.fail('address_required'); end if;
  else
    addr := null;
  end if;
  if length(cname) not between 1 and 120 then perform orders_private.fail('name_required'); end if;
  if cemail is not null and (length(cemail) > 254 or cemail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    perform orders_private.fail('bad_email');
  end if;
  if phone is not null and (length(phone) > 32 or orders_private.phone_digits(phone) is null) then
    perform orders_private.fail('bad_phone');
  end if;
  if cnote is not null and length(cnote) > 1000 then perform orders_private.fail('note_too_long'); end if;

  if p_rules then
    if (method = 'pickup' and not s.pickup_enabled) or (method = 'delivery' and not s.delivery_enabled) then
      perform orders_private.fail('method_unavailable');
    end if;
    if day < now_local::date or day > now_local::date + least(s.max_days_ahead, orders_private.limit_int('max_days_ahead_cap', 365)) then
      perform orders_private.fail('date_out_of_range', jsonb_build_object('max_days_ahead', s.max_days_ahead));
    end if;
    hours := case when method = 'pickup' then s.pickup_hours else s.delivery_hours end;
    if not orders_private.fits_hours(hours, day, t_from, t_to) then
      perform orders_private.fail('closed', jsonb_build_object('date', day));
    end if;
    -- lead time is measured to the chosen time, else to the day's closing time
    lead_ref := coalesce(t_from, orders_private.day_close(hours, day));
    if s.max_orders_per_day is not null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('orders_day:' || p_owner::text || ':' || day::text, 0));
      if (select count(*) from public.orders x
           where x.owner_user_id = p_owner and x.fulfil_on = day
             and x.status not in ('cancelled', 'rejected')) >= s.max_orders_per_day then
        perform orders_private.fail('day_full', jsonb_build_object('date', day));
      end if;
    end if;
    if phone is not null and (
         select count(*) from public.orders x
          where x.owner_user_id = p_owner and x.status = 'pending'
            and orders_private.phone_digits(x.customer_phone) = orders_private.phone_digits(phone))
       >= orders_private.limit_int('max_pending_per_customer', 3) then
      perform orders_private.fail('too_many_pending');
    end if;
    if s.ask_customer_email = 'required' and nullif(btrim(coalesce(p_payload->>'customer_email', '')), '') is null then
      perform orders_private.fail('email_required');
    end if;
  end if;

  insert into public.order_counters (owner_user_id, last_number) values (p_owner, 1)
  on conflict (owner_user_id) do update set last_number = public.order_counters.last_number + 1
  returning last_number into num;

  expiry_h := least(s.pending_expiry_hours, orders_private.limit_int('max_pending_expiry_hours', 72));

  insert into public.orders (
    owner_user_id, order_number, status, source,
    customer_name, customer_phone, customer_email, customer_locale, customer_user_id, agent_thread_id,
    fulfilment_method, fulfil_on, fulfil_from, fulfil_to, delivery_address,
    currency, subtotal_cents, delivery_fee_cents, total_cents,
    customer_note, client_request_id, expires_at, confirmed_at
  ) values (
    p_owner, num, p_status, p_source,
    cname, phone, cemail,
    left(nullif(p_payload->>'customer_locale', ''), 10),
    nullif(p_payload->>'customer_user_id', '')::uuid,
    nullif(p_payload->>'agent_thread_id', '')::uuid,
    method, day, t_from, t_to, addr,
    s.currency, 0, 0, 0,
    cnote, req_id,
    case when p_status = 'pending' then now() + make_interval(hours => expiry_h) end,
    case when p_status = 'confirmed' then now() end
  )
  returning * into o;

  subtotal := orders_private.write_items(o.id, p_owner, p_payload->'items', day, p_rules, now_local, s, lead_ref);

  if method = 'delivery' then
    if p_rules and s.delivery_min_order_cents is not null and subtotal < s.delivery_min_order_cents then
      perform orders_private.fail('below_minimum', jsonb_build_object('minimum_cents', s.delivery_min_order_cents));
    end if;
    fee := case when s.free_delivery_over_cents is not null and subtotal >= s.free_delivery_over_cents
                then 0 else s.delivery_fee_cents end;
  end if;

  update public.orders
     set subtotal_cents = subtotal, delivery_fee_cents = fee, total_cents = subtotal + fee
   where id = o.id
  returning * into o;

  insert into public.order_events (order_id, owner_user_id, actor, type, to_status, data)
  values (o.id, p_owner, p_actor, 'created', o.status, jsonb_build_object('source', p_source));

  return o;
end;
$$;

-- Allowed status moves. Delivery-only and pickup-only steps are respected.
create or replace function orders_private.can_transition(p_from text, p_to text, p_method text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'pending'          then p_to in ('confirmed', 'rejected', 'cancelled')
    when 'confirmed'        then p_to in ('preparing', 'ready', 'completed', 'cancelled')
                                 or (p_to = 'out_for_delivery' and p_method = 'delivery')
    when 'preparing'        then p_to in ('ready', 'cancelled')
                                 or (p_to = 'out_for_delivery' and p_method = 'delivery')
    when 'ready'            then p_to in ('completed', 'cancelled')
                                 or (p_to = 'out_for_delivery' and p_method = 'delivery')
    when 'out_for_delivery' then p_to in ('completed', 'cancelled')
    else false
  end;
$$;

-- Move an order to a new status (caller already checked who may do it).
-- The row is locked first so owner, customer and the expiry job can't race.
create or replace function orders_private.set_status(p_order_id uuid, p_to text, p_actor text, p_reason text)
returns public.orders
language plpgsql
set search_path = ''
as $$
declare
  o      public.orders%rowtype;
  before text;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then perform orders_private.fail('not_found'); end if;
  before := o.status;
  if before = p_to then return o; end if;
  if not orders_private.can_transition(before, p_to, o.fulfilment_method) then
    perform orders_private.fail('bad_transition', jsonb_build_object('from', before, 'to', p_to));
  end if;

  if p_to in ('cancelled', 'rejected') then
    perform orders_private.release_stock(o.id);
  end if;

  update public.orders set
    status        = p_to,
    expires_at    = null,
    confirmed_at  = case when p_to = 'confirmed' then now() else confirmed_at end,
    ready_at      = case when p_to = 'ready' then now() else ready_at end,
    completed_at  = case when p_to = 'completed' then now() else completed_at end,
    cancelled_at  = case when p_to in ('cancelled', 'rejected') then now() else cancelled_at end,
    cancel_reason = case when p_to in ('cancelled', 'rejected')
                         then left(nullif(btrim(coalesce(p_reason, '')), ''), 300) else cancel_reason end,
    updated_at    = now()
  where id = o.id
  returning * into o;

  insert into public.order_events (order_id, owner_user_id, actor, type, from_status, to_status, data)
  values (o.id, o.owner_user_id, p_actor, 'status', before, p_to,
          case when p_reason is not null then jsonb_build_object('reason', left(p_reason, 300)) else '{}'::jsonb end);
  return o;
end;
$$;

-- Business error → {ok:false, error, detail}. Used by every public wrapper.
create or replace function orders_private.error_json(p_message text, p_detail text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  d jsonb;
begin
  begin
    d := nullif(p_detail, '')::jsonb;
  exception when others then
    d := null;
  end;
  return jsonb_build_object('ok', false, 'error', substr(p_message, 8), 'detail', coalesce(d, '{}'::jsonb));
end;
$$;

-- ── 9. Owner RPCs (owner = auth.uid(), never a parameter) ────────────────────
create or replace function public.owner_create_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  o   public.orders%rowtype;
  msg text;
  det text;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 50000 then
    return jsonb_build_object('ok', false, 'error', 'bad_request', 'detail', '{}'::jsonb);
  end if;
  begin
    o := orders_private.create_order(
      uid,
      -- the owner can't attach someone else's thread or profile to an order
      p_payload - 'agent_thread_id' - 'customer_user_id',
      'manual', 'owner', false, 'confirmed');
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics msg = message_text, det = pg_exception_detail;
      if msg like 'orders:%' then return orders_private.error_json(msg, det); end if;
      raise;
    when check_violation or not_null_violation or invalid_text_representation or invalid_datetime_format
         or datetime_field_overflow or numeric_value_out_of_range then
      return jsonb_build_object('ok', false, 'error', 'invalid_value', 'detail', '{}'::jsonb);
  end;
  return jsonb_build_object('ok', true, 'order_id', o.id, 'order_number', o.order_number, 'total_cents', o.total_cents);
end;
$$;

create or replace function public.owner_set_order_status(p_order_id uuid, p_status text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  o   public.orders%rowtype;
  msg text;
  det text;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if not exists (select 1 from public.orders where id = p_order_id and owner_user_id = uid) then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'detail', '{}'::jsonb);
  end if;
  begin
    o := orders_private.set_status(p_order_id, p_status, 'owner', p_reason);
  exception when sqlstate 'P0001' then
    get stacked diagnostics msg = message_text, det = pg_exception_detail;
    if msg like 'orders:%' then return orders_private.error_json(msg, det); end if;
    raise;
  end;
  return jsonb_build_object('ok', true, 'status', o.status);
end;
$$;

-- Edit details. Customer/fulfilment fields only while the order is open;
-- internal note and payment fields always. Unknown keys are ignored.
create or replace function public.owner_update_order(p_order_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := auth.uid();
  o       public.orders%rowtype;
  s       public.order_settings%rowtype;
  open    boolean;
  method  text;
  addr    jsonb;
  fee     bigint;
  pstatus text;
  msg     text;
  det     text;
  changed text[];
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or octet_length(p_patch::text) > 20000 then
    return jsonb_build_object('ok', false, 'error', 'bad_request', 'detail', '{}'::jsonb);
  end if;
  select * into o from public.orders where id = p_order_id and owner_user_id = uid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found', 'detail', '{}'::jsonb); end if;
  select * into s from public.order_settings where owner_user_id = uid;
  open := o.status not in ('completed', 'cancelled', 'rejected');
  select array_agg(k) into changed from jsonb_object_keys(p_patch) k;
  if changed is null then return jsonb_build_object('ok', true); end if;

  begin
    if not open and exists (select 1 from unnest(changed) k
                             where k not in ('internal_note', 'payment_status', 'payment_method', 'amount_paid_cents')) then
      perform orders_private.fail('order_closed');
    end if;

    method := coalesce(p_patch->>'fulfilment_method', o.fulfilment_method);
    if method not in ('pickup', 'delivery') then perform orders_private.fail('bad_method'); end if;
    addr := case when p_patch ? 'delivery_address' then nullif(p_patch->'delivery_address', 'null'::jsonb) else o.delivery_address end;
    if method = 'delivery' and (addr is null or not orders_private.valid_address(addr)) then
      perform orders_private.fail('address_required');
    end if;
    if method = 'pickup' then addr := null; end if;
    fee := case when method = 'delivery'
                then case when s.free_delivery_over_cents is not null and o.subtotal_cents >= s.free_delivery_over_cents
                          then 0 else coalesce(s.delivery_fee_cents, 0) end
                else 0 end;
    if method = o.fulfilment_method then fee := o.delivery_fee_cents; end if;

    pstatus := coalesce(p_patch->>'payment_status', o.payment_status);
    if pstatus not in ('unpaid', 'paid', 'refunded', 'partially_refunded') then perform orders_private.fail('bad_payment'); end if;
    if p_patch ? 'payment_method' and nullif(p_patch->>'payment_method', '') is not null
       and p_patch->>'payment_method' not in ('cash', 'card_in_person', 'bank_transfer') then
      -- 'online' is reserved for the Stripe integration
      perform orders_private.fail('bad_payment');
    end if;

    update public.orders set
      customer_name     = case when p_patch ? 'customer_name' then btrim(p_patch->>'customer_name') else customer_name end,
      customer_phone    = case when p_patch ? 'customer_phone' then nullif(btrim(coalesce(p_patch->>'customer_phone', '')), '') else customer_phone end,
      customer_email    = case when p_patch ? 'customer_email' then lower(nullif(btrim(coalesce(p_patch->>'customer_email', '')), '')) else customer_email end,
      customer_locale   = case when p_patch ? 'customer_locale' then nullif(p_patch->>'customer_locale', '') else customer_locale end,
      fulfilment_method = method,
      delivery_address  = addr,
      delivery_fee_cents = fee,
      total_cents       = subtotal_cents + fee,
      fulfil_on         = case when p_patch ? 'fulfil_on' then (p_patch->>'fulfil_on')::date else fulfil_on end,
      fulfil_from       = case when p_patch ? 'fulfil_from' then nullif(p_patch->>'fulfil_from', '')::time else fulfil_from end,
      fulfil_to         = case when p_patch ? 'fulfil_to' then nullif(p_patch->>'fulfil_to', '')::time else fulfil_to end,
      customer_note     = case when p_patch ? 'customer_note' then nullif(btrim(coalesce(p_patch->>'customer_note', '')), '') else customer_note end,
      internal_note     = case when p_patch ? 'internal_note' then nullif(btrim(coalesce(p_patch->>'internal_note', '')), '') else internal_note end,
      payment_status    = pstatus,
      payment_method    = case when p_patch ? 'payment_method' then nullif(p_patch->>'payment_method', '') else payment_method end,
      amount_paid_cents = case when p_patch ? 'amount_paid_cents' then nullif(p_patch->>'amount_paid_cents', '')::bigint
                               when pstatus = 'paid' and payment_status <> 'paid' then subtotal_cents + fee
                               else amount_paid_cents end,
      paid_at           = case when pstatus = 'paid' and payment_status <> 'paid' then now()
                               when pstatus = 'unpaid' then null else paid_at end,
      updated_at        = now()
    where id = o.id;

    insert into public.order_events (order_id, owner_user_id, actor, type, data)
    values (o.id, uid, 'owner',
            case when changed <@ array['payment_status', 'payment_method', 'amount_paid_cents'] then 'payment'
                 when changed <@ array['internal_note'] then 'note'
                 else 'edited' end,
            jsonb_build_object('fields', to_jsonb(changed)));
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics msg = message_text, det = pg_exception_detail;
      if msg like 'orders:%' then return orders_private.error_json(msg, det); end if;
      raise;
    when check_violation or not_null_violation or invalid_text_representation or invalid_datetime_format
         or datetime_field_overflow or numeric_value_out_of_range then
      return jsonb_build_object('ok', false, 'error', 'invalid_value', 'detail', '{}'::jsonb);
  end;
  return jsonb_build_object('ok', true);
end;
$$;

-- Replace the lines of an open (pending/confirmed) order: give back the old
-- stock, hold the new, recompute totals. Owner override rules (p_rules=false).
create or replace function public.owner_replace_order_items(p_order_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid      uuid := auth.uid();
  o        public.orders%rowtype;
  s        public.order_settings%rowtype;
  subtotal bigint;
  fee      bigint;
  msg      text;
  det      text;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_items is null or octet_length(p_items::text) > 50000 then
    return jsonb_build_object('ok', false, 'error', 'bad_request', 'detail', '{}'::jsonb);
  end if;
  select * into o from public.orders where id = p_order_id and owner_user_id = uid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found', 'detail', '{}'::jsonb); end if;
  select * into s from public.order_settings where owner_user_id = uid;
  begin
    if o.status not in ('pending', 'confirmed') then perform orders_private.fail('order_closed'); end if;
    perform orders_private.release_stock(o.id);
    delete from public.order_items where order_id = o.id;
    subtotal := orders_private.write_items(o.id, uid, p_items, o.fulfil_on, false,
                                           (now() at time zone s.timezone), s, o.fulfil_from);
    fee := case when o.fulfilment_method = 'delivery'
                then case when s.free_delivery_over_cents is not null and subtotal >= s.free_delivery_over_cents
                          then 0 else s.delivery_fee_cents end
                else 0 end;
    update public.orders set subtotal_cents = subtotal, delivery_fee_cents = fee, total_cents = subtotal + fee, updated_at = now()
     where id = o.id;
    insert into public.order_events (order_id, owner_user_id, actor, type, data)
    values (o.id, uid, 'owner', 'items', jsonb_build_object('subtotal_cents', subtotal));
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics msg = message_text, det = pg_exception_detail;
      if msg like 'orders:%' then return orders_private.error_json(msg, det); end if;
      raise;
    when check_violation or not_null_violation or invalid_text_representation or invalid_datetime_format
         or datetime_field_overflow or numeric_value_out_of_range then
      return jsonb_build_object('ok', false, 'error', 'invalid_value', 'detail', '{}'::jsonb);
  end;
  return jsonb_build_object('ok', true, 'total_cents', subtotal + fee);
end;
$$;

-- Owner's own blocked reason (for the dashboard banner).
create or replace function public.owner_orders_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  return jsonb_build_object(
    'manual_blocked', orders_private.blocked_reason(uid, false, 'manual'),
    'agent_blocked', orders_private.blocked_reason(uid, true, 'agent'),
    'product_limit', orders_private.product_limit(uid));
end;
$$;

-- ── 10. Pending expiry (pg_cron) ────────────────────────────────────────────
create or replace function orders_private.expire_pending_orders()
returns int
language plpgsql
set search_path = ''
as $$
declare
  r   record;
  n   int := 0;
begin
  for r in
    select id from public.orders
     where status = 'pending' and expires_at <= now()
     order by expires_at
     limit 500
     for update skip locked
  loop
    begin
      perform orders_private.set_status(r.id, 'cancelled', 'system', 'expired');
      n := n + 1;
    exception when sqlstate 'P0001' then
      null; -- already moved on by the owner; nothing to do
    end;
  end loop;
  return n;
end;
$$;

do $$
begin
  perform cron.unschedule('orders-expire-pending')
    where exists (select 1 from cron.job where jobname = 'orders-expire-pending');
end $$;

select cron.schedule('orders-expire-pending', '*/5 * * * *', $$select orders_private.expire_pending_orders()$$);

-- ── 11. Owner alerts (bell + live banner) ───────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array['new_booking', 'booking_cancelled', 'booking_rescheduled',
                           'new_order', 'order_cancelled', 'order_expired']::text[]));

-- Driven by order_events so the actor is known: no alert for the owner's own
-- actions.
create or replace function orders_private.notify_owner_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  o    public.orders%rowtype;
  kind text;
begin
  if new.actor = 'owner' then return new; end if;
  if new.type = 'created' then
    kind := 'new_order';
  elsif new.type = 'status' and new.to_status = 'cancelled' then
    kind := case when new.actor = 'system' then 'order_expired' else 'order_cancelled' end;
  else
    return new;
  end if;
  select * into o from public.orders where id = new.order_id;
  insert into public.notifications (user_id, type, payload)
  values (o.owner_user_id, kind, jsonb_build_object(
    'order_id', o.id,
    'order_number', o.order_number,
    'customer_name', o.customer_name,
    'status', o.status,
    'total_cents', o.total_cents,
    'currency', o.currency,
    'fulfilment_method', o.fulfilment_method,
    'fulfil_on', o.fulfil_on,
    'fulfil_from', o.fulfil_from));
  return new;
end;
$$;

drop trigger if exists order_events_notify on public.order_events;
create trigger order_events_notify after insert on public.order_events
  for each row execute function orders_private.notify_owner_order_event();

-- ── 12. Agent autonomy keys (used in Phase 4) ───────────────────────────────
alter table public.agent_settings
  alter column autonomy set default
    '{"new_booking":"pending","reschedule":"pending","cancel":"pending","new_order":"pending","cancel_order":"confirm"}'::jsonb;
update public.agent_settings
   set autonomy = '{"new_order":"pending","cancel_order":"confirm"}'::jsonb || autonomy
 where not (autonomy ? 'new_order' and autonomy ? 'cancel_order');

-- ── 13. Function privileges ─────────────────────────────────────────────────
revoke all on all functions in schema orders_private from public, anon, authenticated;

revoke all on function public.owner_create_order(jsonb) from public, anon;
revoke all on function public.owner_set_order_status(uuid, text, text) from public, anon;
revoke all on function public.owner_update_order(uuid, jsonb) from public, anon;
revoke all on function public.owner_replace_order_items(uuid, jsonb) from public, anon;
revoke all on function public.owner_orders_status() from public, anon;
grant execute on function public.owner_create_order(jsonb) to authenticated;
grant execute on function public.owner_set_order_status(uuid, text, text) to authenticated;
grant execute on function public.owner_update_order(uuid, jsonb) to authenticated;
grant execute on function public.owner_replace_order_items(uuid, jsonb) to authenticated;
grant execute on function public.owner_orders_status() to authenticated;

-- CHECK constraints on owner-written tables call these two validators.
grant usage on schema orders_private to authenticated, service_role;
grant execute on function orders_private.valid_hours(jsonb) to authenticated, service_role;
grant execute on function orders_private.valid_address(jsonb) to authenticated, service_role;
