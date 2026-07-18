-- Reconciles prod with the current initial_schema.sql: prod was migrated from an
-- earlier revision that didn't yet include chat_rate_limits + three RPCs. All
-- statements below are idempotent — safe to re-run on dev (already has these).

-- ── chat_rate_limits table ────────────────────────────────────────────────
create table if not exists public.chat_rate_limits (
  key          text        primary key,
  count        int         not null default 0,
  window_start timestamptz not null default now()
);

alter table public.chat_rate_limits enable row level security;

drop policy if exists "no_client_access_chat_rate_limits" on public.chat_rate_limits;
create policy "no_client_access_chat_rate_limits"
  on public.chat_rate_limits for all
  using (false) with check (false);

-- ── assert_chat_rate_limit RPC ────────────────────────────────────────────
create or replace function public.assert_chat_rate_limit(
  p_key            text,
  p_max            int,
  p_window_seconds int
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now   timestamptz := now();
  v_count int;
begin
  insert into public.chat_rate_limits (key, count, window_start)
  values (p_key, 1, v_now)
  on conflict (key) do update
    set count = case
          when public.chat_rate_limits.window_start
               < v_now - make_interval(secs => p_window_seconds)
            then 1
          else public.chat_rate_limits.count + 1
        end,
        window_start = case
          when public.chat_rate_limits.window_start
               < v_now - make_interval(secs => p_window_seconds)
            then v_now
          else public.chat_rate_limits.window_start
        end
  returning count into v_count;

  if v_count > p_max then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  return v_count;
end;
$$;

revoke all on function public.assert_chat_rate_limit(text, int, int) from public;
grant execute on function public.assert_chat_rate_limit(text, int, int) to service_role;

-- ── chat_rate_limit app_settings default ──────────────────────────────────
insert into public.app_settings (key, value, description) values
  ('chat_rate_limit',
   jsonb_build_object('per_ip_per_owner_hourly', 30, 'per_owner_hourly', 240),
   'Hourly chat caps to prevent owner-credit drain abuse.')
on conflict (key) do nothing;

-- ── claim_signup_profile RPC ──────────────────────────────────────────────
-- OAuth signup grant. Without this, Google/etc signups on prod don't get
-- their welcome credits — the handle_new_user trigger only fires for
-- email/password signups.
create or replace function public.claim_signup_profile(
  p_username     text,
  p_display_name text default null
)
returns table (
  profile_id         uuid,
  free_space_credits int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_grant    int  := 100;
  v_existing public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_username is null
     or length(p_username) < 3 or length(p_username) > 30
     or p_username !~ '^[a-z0-9_-]+$' then
    raise exception 'INVALID_USERNAME' using errcode = 'P0001';
  end if;

  select * into v_existing from public.profiles where id = v_uid;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.free_space_credits;
    return;
  end if;

  select coalesce((value->>'amount')::int, 100) into v_grant
  from public.app_settings where key = 'signup_credit_grant';
  v_grant := coalesce(v_grant, 100);
  if v_grant < 0 then v_grant := 0; end if;

  begin
    insert into public.profiles (id, username, display_name, free_space_credits)
    values (
      v_uid,
      p_username,
      coalesce(nullif(p_display_name, ''), p_username),
      v_grant
    );
  exception when unique_violation then
    raise exception 'USERNAME_TAKEN' using errcode = 'P0001';
  end;

  if v_grant > 0 then
    insert into public.credit_ledger (
      user_id, delta, bucket, reason,
      balance_after_free, balance_after_paid, metadata
    ) values (
      v_uid, v_grant, 'free_space', 'signup_grant',
      v_grant, 0, jsonb_build_object('source', 'oauth_setup')
    );
  end if;

  return query select v_uid, v_grant;
end;
$$;

revoke all on function public.claim_signup_profile(text, text) from public;
grant execute on function public.claim_signup_profile(text, text) to authenticated;

-- ── save_llm_model RPC ────────────────────────────────────────────────────
create or replace function public.save_llm_model(
  p_id                   uuid,
  p_display_name         text,
  p_input_credits_per_1k numeric,
  p_output_credits_per_1k numeric,
  p_default_for_role     text,
  p_active               boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_default_for_role is not null
     and p_default_for_role not in ('agent_chat', 'page_editor') then
    raise exception 'invalid role' using errcode = 'P0001';
  end if;

  if p_default_for_role is not null and p_active then
    update public.llm_models
       set default_for_role = null,
           updated_at       = now()
     where default_for_role = p_default_for_role
       and id <> p_id
       and active = true;
  end if;

  update public.llm_models
     set display_name           = p_display_name,
         input_credits_per_1k   = p_input_credits_per_1k,
         output_credits_per_1k  = p_output_credits_per_1k,
         default_for_role       = p_default_for_role,
         active                 = p_active,
         updated_at             = now()
   where id = p_id;
end;
$$;

revoke all on function public.save_llm_model(uuid, text, numeric, numeric, text, boolean) from public;
grant execute on function public.save_llm_model(uuid, text, numeric, numeric, text, boolean) to service_role;
