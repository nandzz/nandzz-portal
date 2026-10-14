-- Demo accounts + claim codes.
--
-- Nandzz admins pre-build public profiles for prospective clients ("demo
-- profiles") through the admin-only MCP endpoint (mcp-admin) or nandzz-admin.
-- profiles.id is FK'd to auth.users, so every demo is backed by a placeholder
-- auth user nobody can sign in as. The business later signs up / logs in at
-- /claim and redeems a one-time code; claim_demo_profile() copies the demo
-- profile onto the claimer's auth id, re-points the demo's content, and
-- deletes the placeholder.
--
-- Also: admin MCP token audience. Admin tokens carry the 'admin' scope; the
-- public mcp_verify_token rejects them and mcp_verify_admin_token only accepts
-- them, so neither endpoint accepts the other's tokens.

create extension if not exists pgcrypto with schema extensions;

-- ── 1. profiles.is_demo ─────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists is_demo boolean not null default false;

create index if not exists idx_profiles_is_demo on public.profiles(is_demo) where is_demo;

-- Re-declare the protected-columns guard with is_demo added.
create or replace function public.profiles_protect_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only end-user roles are restricted; service role and SECURITY DEFINER
  -- functions (which run as their owner) pass through.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.id                          is distinct from old.id
  or new.created_at                  is distinct from old.created_at
  or new.is_admin                    is distinct from old.is_admin
  or new.is_demo                     is distinct from old.is_demo
  or new.paid_credits                is distinct from old.paid_credits
  or new.plan_credits                is distinct from old.plan_credits
  or new.plan_slug                   is distinct from old.plan_slug
  or new.plan_status                 is distinct from old.plan_status
  or new.plan_stripe_subscription_id is distinct from old.plan_stripe_subscription_id
  or new.plan_current_period_end     is distinct from old.plan_current_period_end
  or new.plan_cancel_at_period_end   is distinct from old.plan_cancel_at_period_end
  or new.stripe_customer_id          is distinct from old.stripe_customer_id
  or new.has_used_trial              is distinct from old.has_used_trial
  or new.comp_expires_at             is distinct from old.comp_expires_at
  or new.comp_granted_by             is distinct from old.comp_granted_by
  or new.comp_note                   is distinct from old.comp_note
  or new.followers_count             is distinct from old.followers_count
  or new.following_count             is distinct from old.following_count
  then
    raise exception 'PROTECTED_COLUMN' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.profiles_protect_columns() from public, anon, authenticated;

-- ── 2. demo_claim_codes ─────────────────────────────────────────────────────
-- Plaintext codes are shown once at creation and never stored. code_hash is
-- sha256 hex of the NORMALIZED code (uppercase, alphanumerics only), so
-- "ndz-ab12-cd34" and "NDZAB12CD34" redeem the same code.
create table if not exists public.demo_claim_codes (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  code_hash   text not null unique,
  code_hint   text not null,
  expires_at  timestamptz not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  redeemed_at timestamptz,
  -- No FK: the claimer's profile id equals their auth id; keep the record even
  -- if that account is later deleted.
  redeemed_by uuid
);

create index if not exists idx_demo_claim_codes_profile on public.demo_claim_codes(profile_id);

alter table public.demo_claim_codes enable row level security;
-- No policies: service role (nandzz-admin, mcp-admin) + the definer RPC only.

-- ── 3. admin_audit_log ──────────────────────────────────────────────────────
create table if not exists public.admin_audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles(id) on delete set null,
  source     text not null,             -- 'mcp-admin' | 'nandzz-admin'
  action     text not null,             -- tool / action name
  target_id  uuid,
  details    jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_created on public.admin_audit_log(created_at desc);

alter table public.admin_audit_log enable row level security;
-- No policies: service role only.

-- ── 4. claim_demo_profile ───────────────────────────────────────────────────
create or replace function public.claim_demo_profile(p_code text)
returns table (demo_id uuid, username text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid      uuid := auth.uid();
  v_norm     text;
  v_hash     text;
  v_code     public.demo_claim_codes%rowtype;
  v_demo     public.profiles%rowtype;
  v_new      public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  v_norm := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if length(v_norm) < 8 then
    raise exception 'INVALID_CODE' using errcode = 'P0001';
  end if;
  v_hash := encode(extensions.digest(v_norm, 'sha256'), 'hex');

  select * into v_code from public.demo_claim_codes
   where code_hash = v_hash
   for update;
  if not found
     or v_code.redeemed_at is not null
     or v_code.revoked_at is not null
     or v_code.expires_at < now() then
    raise exception 'INVALID_CODE' using errcode = 'P0001';
  end if;

  select * into v_demo from public.profiles where id = v_code.profile_id for update;
  if not found or not v_demo.is_demo then
    raise exception 'INVALID_CODE' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'ALREADY_HAS_PROFILE' using errcode = 'P0001';
  end if;

  -- Free the username, then clone the demo row onto the claimer's id. Using
  -- jsonb_populate_record copies every content/brand/layout column without
  -- listing them, so future profile columns carry over automatically.
  update public.profiles
     set username = 'demo-claimed-' || replace(v_demo.id::text, '-', '')
   where id = v_demo.id;

  v_new := jsonb_populate_record(
    null::public.profiles,
    to_jsonb(v_demo) || jsonb_build_object(
      'id',                          v_uid,
      'is_demo',                     false,
      'is_admin',                    false,
      'created_at',                  now(),
      -- Demos never have Stripe state or credits. A complimentary Pro period
      -- granted to the demo (so its booking widget renders) is deliberately
      -- carried over: plan_slug / plan_status / comp_* are NOT overridden, so
      -- the business keeps its configured widget until the comp expires.
      'plan_credits',                0,
      'paid_credits',                0,
      'plan_stripe_subscription_id', null,
      'plan_cancel_at_period_end',   false,
      'stripe_customer_id',          null,
      'has_used_trial',              false,
      'followers_count',             0,
      'following_count',             0
    )
  );
  insert into public.profiles select (v_new).*;

  -- Re-point the demo's content to the claimer.
  update public.spaces                   set user_id       = v_uid where user_id       = v_demo.id;
  update public.collections              set user_id       = v_uid where user_id       = v_demo.id;
  update public.widget_instances         set user_id       = v_uid where user_id       = v_demo.id;
  update public.widget_subscriptions     set user_id       = v_uid where user_id       = v_demo.id;
  update public.widget_bookings          set owner_user_id = v_uid where owner_user_id = v_demo.id;
  update public.widget_booking_segments  set owner_user_id = v_uid where owner_user_id = v_demo.id;
  update public.profile_views            set profile_id    = v_uid where profile_id    = v_demo.id;

  update public.demo_claim_codes
     set redeemed_at = now(), redeemed_by = v_uid
   where id = v_code.id;
  -- Other outstanding codes for this demo die with it (cascade below), but
  -- detach the redeemed one first so the audit trail survives.
  update public.demo_claim_codes set profile_id = v_uid where id = v_code.id;

  insert into public.admin_audit_log (actor_id, source, action, target_id, details)
  values (v_uid, 'portal', 'claim_demo_profile', v_demo.id,
          jsonb_build_object('username', v_demo.username, 'code_id', v_code.id));

  -- Drop the placeholder auth user; cascades the old demo profile row and
  -- whatever is still attached to it (unused codes, mcp tokens, …).
  delete from auth.users where id = v_demo.id;

  return query select v_demo.id, v_demo.username;
end;
$$;

revoke all on function public.claim_demo_profile(text) from public, anon;
grant execute on function public.claim_demo_profile(text) to authenticated;

-- ── 5. No bookings on unclaimed demos ───────────────────────────────────────
-- A demo's booking widget is fully configured and visible, but nobody is
-- behind it yet — refuse every booking path (public form, MCP, agent) at the
-- table. WIDGET_UNAVAILABLE maps to the existing "Booking isn't available for
-- this business." copy in the booking funnel.
create or replace function public.widget_bookings_block_demo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where id = new.owner_user_id and is_demo) then
    raise exception 'WIDGET_UNAVAILABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.widget_bookings_block_demo() from public, anon, authenticated;

drop trigger if exists widget_bookings_block_demo on public.widget_bookings;
create trigger widget_bookings_block_demo
  before insert on public.widget_bookings
  for each row execute function public.widget_bookings_block_demo();

-- ── 6. MCP token audience ───────────────────────────────────────────────────
-- Public endpoint: reject admin-scoped tokens.
create or replace function public.mcp_verify_token(p_raw text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_row  public.mcp_tokens%rowtype;
begin
  if p_raw is null or p_raw = '' then
    return null;
  end if;

  v_hash := encode(extensions.digest(p_raw, 'sha256'), 'hex');
  select * into v_row from public.mcp_tokens where token_hash = v_hash;

  if not found then return null; end if;
  if v_row.revoked_at is not null then return null; end if;
  if v_row.expires_at is not null and v_row.expires_at < now() then return null; end if;
  if 'admin' = any(v_row.scopes) then return null; end if;

  update public.mcp_tokens set last_used_at = now() where id = v_row.id;

  return v_row.user_id;
end;
$$;

revoke all on function public.mcp_verify_token(text) from public, anon, authenticated;
grant execute on function public.mcp_verify_token(text) to service_role;

-- Admin endpoint: only admin-scoped tokens whose owner is still an admin.
create or replace function public.mcp_verify_admin_token(p_raw text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_row  public.mcp_tokens%rowtype;
begin
  if p_raw is null or p_raw = '' then
    return null;
  end if;

  v_hash := encode(extensions.digest(p_raw, 'sha256'), 'hex');
  select * into v_row from public.mcp_tokens where token_hash = v_hash;

  if not found then return null; end if;
  if v_row.revoked_at is not null then return null; end if;
  if v_row.expires_at is null or v_row.expires_at < now() then return null; end if;
  if not ('admin' = any(v_row.scopes)) then return null; end if;
  if not exists (select 1 from public.profiles where id = v_row.user_id and is_admin) then
    return null;
  end if;

  update public.mcp_tokens set last_used_at = now() where id = v_row.id;

  return v_row.user_id;
end;
$$;

revoke all on function public.mcp_verify_admin_token(text) from public, anon, authenticated;
grant execute on function public.mcp_verify_admin_token(text) to service_role;
