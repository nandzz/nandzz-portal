-- Username changes: users may change their username at most 2 times in any
-- rolling 60-day window.
--
-- 1. username_changes: one row per change (old → new). Feeds the rate limit
--    and lets /<old-username> redirect to the new page.
-- 2. profiles.username becomes a protected column: end users could previously
--    rewrite it with a direct PostgREST update (no limit, no reserved-name
--    check). Changes now go only through change_username() (definer) or the
--    service role (nandzz-admin, mcp-admin).
-- 3. change_username(p_username): validates, enforces the limit, writes the
--    profile + history row atomically. Reserved route names are checked in the
--    Server Action (same split as claim_signup_profile).

-- ── 1. username_changes ─────────────────────────────────────────────────────
create table if not exists public.username_changes (
  id           bigint generated always as identity primary key,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  old_username text not null,
  new_username text not null,
  changed_at   timestamptz not null default now()
);

create index if not exists idx_username_changes_profile
  on public.username_changes(profile_id, changed_at desc);
create index if not exists idx_username_changes_old
  on public.username_changes(old_username, changed_at desc);

alter table public.username_changes enable row level security;

drop policy if exists "Users read their own username changes" on public.username_changes;
create policy "Users read their own username changes"
  on public.username_changes for select
  to authenticated
  using (profile_id = (select auth.uid()));

revoke insert, update, delete on public.username_changes from anon, authenticated;
revoke select on public.username_changes from anon;

-- ── 2. profiles: username is now protected ──────────────────────────────────
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
  or new.username                    is distinct from old.username
  or new.created_at                  is distinct from old.created_at
  or new.is_admin                    is distinct from old.is_admin
  or new.is_demo                     is distinct from old.is_demo
  or new.support_access_until        is distinct from old.support_access_until
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

-- ── 3. change_username ──────────────────────────────────────────────────────
-- Returns { username, changes_left, next_change_at } (next_change_at is null
-- while a change is still available).
create or replace function public.change_username(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_new    text := lower(btrim(coalesce(p_username, '')));
  v_old    text;
  v_count  int;
  v_oldest timestamptz;
  c_limit  constant int := 2;
  c_window constant interval := interval '60 days';
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if length(v_new) < 3 or length(v_new) > 30 or v_new !~ '^[a-z0-9_-]+$' then
    raise exception 'INVALID_USERNAME' using errcode = 'P0001';
  end if;

  -- Reserved top-level routes (mirror RESERVED_TOP_SEGMENTS in
  -- src/lib/layout/appShell.ts). Checked here too because the RPC is callable
  -- directly via PostgREST, bypassing the Server Action.
  if v_new = any (array[
    'dashboard','pricing','login','forgot-password','contact','cookies',
    'privacy','terms','dpa','acceptable-use','report','legal','guide',
    'setup-username','claim','mcp','go','booking','hashtag','auth','sandbox',
    'space','api','explore','kit'
  ]) then
    raise exception 'INVALID_USERNAME' using errcode = 'P0001';
  end if;

  -- Row lock serializes concurrent changes by the same user, so two parallel
  -- calls can't both pass the limit check.
  select p.username into v_old from public.profiles p where p.id = v_uid for update;
  if not found then
    raise exception 'NO_PROFILE' using errcode = 'P0001';
  end if;

  if v_old = v_new then
    raise exception 'SAME_USERNAME' using errcode = 'P0001';
  end if;

  select count(*), min(uc.changed_at) into v_count, v_oldest
  from public.username_changes uc
  where uc.profile_id = v_uid and uc.changed_at > now() - c_window;

  if v_count >= c_limit then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  begin
    update public.profiles set username = v_new where id = v_uid;
  exception when unique_violation then
    raise exception 'USERNAME_TAKEN' using errcode = 'P0001';
  end;

  insert into public.username_changes (profile_id, old_username, new_username)
  values (v_uid, v_old, v_new);

  return jsonb_build_object(
    'username', v_new,
    'changes_left', c_limit - (v_count + 1),
    'next_change_at', case
      when v_count + 1 >= c_limit then coalesce(v_oldest, now()) + c_window
      else null
    end
  );
end;
$$;

revoke execute on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated, service_role;
