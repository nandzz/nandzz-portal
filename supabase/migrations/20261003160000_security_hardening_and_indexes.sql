-- Security hardening + index pass (2026-10-03 audit).
--
-- 1. SECURITY DEFINER RPCs were executable by anon/authenticated: Supabase's
--    default privileges grant EXECUTE to those roles directly, so the
--    `revoke ... from public` in earlier migrations never removed it (see
--    20261003150000_lock_booking_queue_functions). Lock every public
--    SECURITY DEFINER function to service_role, except the few the user-session
--    client calls (each derives the caller from auth.uid()).
-- 2. profiles: users could UPDATE/INSERT any column of their own row
--    (is_admin, credits, plan, stripe ids …). Protected columns are now
--    writable only by the service role / definer functions.
-- 3. notifications: drop the "any signed-in user may insert for anyone" policy;
--    inserts go through the service role (server actions, triggers).
-- 4. RLS perf: wrap auth.uid() as (select auth.uid()) so it's evaluated once
--    per statement instead of per row.
-- 5. Missing FK / hot-path indexes; drop two redundant ones.
-- 6. Storage: size caps on buckets that had none.

-- ── 1. Lock SECURITY DEFINER functions ──────────────────────────────────────
do $$
declare
  r record;
  user_callable text[] := array[
    'claim_signup_profile',
    'mcp_issue_oauth_code',
    'mcp_issue_token',
    'mcp_revoke_token',
    'widget_customers_summary'
  ];
begin
  for r in
    select p.oid::regprocedure as fn, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.fn);
    execute format('grant execute on function %s to service_role', r.fn);
    if r.proname = any (user_callable) then
      execute format('grant execute on function %s to authenticated', r.fn);
    end if;
  end loop;
end $$;

-- New functions are no longer auto-executable by anon/authenticated: grant
-- explicitly in the migration that creates a user-callable RPC.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ── 2. profiles: protected columns ──────────────────────────────────────────
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

drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.profiles_protect_columns();

-- Profiles are created by handle_new_user / claim_signup_profile (definer);
-- end users never insert rows directly.
drop policy if exists "Users can insert their own profile" on public.profiles;
revoke insert on public.profiles from anon, authenticated;

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ── 3. notifications ────────────────────────────────────────────────────────
drop policy if exists notifications_insert on public.notifications;

-- ── 4. RLS: evaluate auth.uid() once per statement ──────────────────────────
do $$
declare
  r record;
  q text;
  c text;
  stmt text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') like '%auth.uid()%' or coalesce(with_check, '') like '%auth.uid()%')
      and coalesce(qual, '') not like '%SELECT auth.uid()%'
      and coalesce(with_check, '') not like '%SELECT auth.uid()%'
  loop
    q := replace(r.qual, 'auth.uid()', '(select auth.uid())');
    c := replace(r.with_check, 'auth.uid()', '(select auth.uid())');
    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if q is not null then stmt := stmt || format(' using (%s)', q); end if;
    if c is not null then stmt := stmt || format(' with check (%s)', c); end if;
    execute stmt;
  end loop;
end $$;

-- ── 5. Indexes ──────────────────────────────────────────────────────────────
-- "My bookings" list + ON DELETE SET NULL from profiles.
create index if not exists widget_bookings_booker_idx
  on public.widget_bookings (created_by_user_id, starts_at desc)
  where created_by_user_id is not null;
-- Admin "recent bookings".
create index if not exists widget_bookings_created_at_idx
  on public.widget_bookings (created_at desc);

-- Unindexed foreign keys (cascades + per-parent lookups).
create index if not exists comment_likes_comment_id_idx      on public.comment_likes (comment_id);
create index if not exists comment_mentions_comment_id_idx   on public.comment_mentions (comment_id);
create index if not exists space_likes_space_id_idx          on public.space_likes (space_id);
create index if not exists collection_spaces_space_id_idx    on public.collection_spaces (space_id);
create index if not exists widget_booking_segments_owner_idx on public.widget_booking_segments (owner_user_id);
create index if not exists widget_instances_catalog_id_idx   on public.widget_instances (catalog_id);
create index if not exists mcp_oauth_codes_user_id_idx       on public.mcp_oauth_codes (user_id);
create index if not exists llm_usage_space_id_idx            on public.llm_usage (space_id) where space_id is not null;
create index if not exists whatsapp_messages_booking_id_idx  on public.whatsapp_messages (booking_id) where booking_id is not null;
create index if not exists space_views_viewer_id_idx         on public.space_views (viewer_id) where viewer_id is not null;

-- Redundant: prefixes of composite/unique indexes on the same columns.
drop index if exists public.idx_space_views_space_id;
drop index if exists public.idx_collection_spaces_collection_id;

-- ── 6. Storage size caps ────────────────────────────────────────────────────
update storage.buckets
set file_size_limit = 10485760 -- 10 MB
where id in ('avatars', 'profile-backgrounds', 'space-previews', 'space-html')
  and file_size_limit is null;
