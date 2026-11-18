-- Remove the credits concept entirely (Felipe, 2026-11-18): plan allowances,
-- purchased credit packs, the credit ledger and LLM usage metering. No feature
-- spends credits any more (the old agent and the AI page editor are gone).
--
-- Function bodies below are the live definitions (identical on dev + prod)
-- with only the credit parts removed.

-- 1. Credit spending / granting RPCs.
drop function if exists public.assert_min_credits(uuid, integer);
drop function if exists public.reserve_llm_credits(uuid, integer, uuid);
drop function if exists public.refund_llm_reservation(uuid, integer, uuid);
drop function if exists public.charge_llm_usage(uuid, uuid, text, integer, integer, text, uuid, uuid);
drop function if exists public.charge_llm_usage(uuid, uuid, text, integer, integer, text, uuid, uuid, integer);
drop function if exists public.grant_credits(uuid, text, integer, text, text, text, jsonb);
drop function if exists public.agent_can_serve(uuid, uuid);
drop function if exists public.save_llm_model(uuid, text, numeric, numeric, text, boolean);

-- The AI master switch has nothing left to gate.
delete from public.app_settings where key = 'ai_enabled';

-- 2. Plan activation / comp grant no longer refill credits.
create or replace function public.set_user_plan(p_user_id uuid, p_plan_slug text, p_status text, p_sub_id text, p_period_end timestamp with time zone, p_cancel_at_period_end boolean default false)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_old public.profiles%rowtype;
begin
  if not exists (select 1 from public.subscription_plans where slug = p_plan_slug) then
    raise exception 'plan not found: %', p_plan_slug using errcode = 'P0001';
  end if;

  select * into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0001';
  end if;

  update public.profiles set
    plan_slug                 = p_plan_slug,
    plan_status               = p_status,
    plan_stripe_subscription_id = p_sub_id,
    plan_current_period_end   = p_period_end,
    plan_cancel_at_period_end = coalesce(p_cancel_at_period_end, false)
  where id = p_user_id;
end;
$function$;

create or replace function public.grant_comp_plan(p_user_id uuid, p_days integer, p_granted_by uuid, p_note text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_old public.profiles%rowtype;
begin
  if coalesce(p_days, 0) <= 0 then
    raise exception 'p_days must be a positive integer' using errcode = 'P0001';
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'p_note is required' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.subscription_plans where slug = 'pro') then
    raise exception 'plan not found: pro' using errcode = 'P0001';
  end if;

  select * into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0001';
  end if;

  -- Refuse to overwrite a genuine paid/trialing subscription — the next Stripe
  -- webhook event would clobber the comp anyway. Comp is for non-subscribers.
  if v_old.plan_status in ('active', 'trialing')
     and v_old.plan_stripe_subscription_id is not null then
    raise exception 'user already has an active subscription' using errcode = 'P0002';
  end if;

  update public.profiles set
    plan_slug       = 'pro',
    plan_status     = 'comp',
    comp_expires_at = now() + make_interval(days => p_days),
    comp_granted_by = p_granted_by,
    comp_note       = p_note
  where id = p_user_id;
end;
$function$;

drop function if exists public.refill_plan_credits(uuid, text);

-- 3. publish_space_tx returns only the new space id (return type changes, so
-- drop + create and restore the service_role-only grant).
drop function if exists public.publish_space_tx(uuid, jsonb, uuid);
create function public.publish_space_tx(p_user_id uuid, p_space_payload jsonb, p_client_request_id uuid)
 returns table(space_id uuid)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_profile        public.profiles%rowtype;
  v_limit          int;
  v_count          int;
  v_existing_space uuid;
  v_new_space_id   uuid;
  v_content_type   text;
begin
  if p_user_id is null then
    raise exception 'user_id required' using errcode = 'P0001';
  end if;

  -- Idempotent retry: if a row already exists for this client_request_id, return it.
  if p_client_request_id is not null then
    select id into v_existing_space
    from public.spaces
    where user_id = p_user_id and client_request_id = p_client_request_id;

    if v_existing_space is not null then
      return query select v_existing_space;
      return;
    end if;
  end if;

  -- Lock the profile to serialize concurrent publishes against the space cap.
  select * into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'profile not found' using errcode = 'P0001';
  end if;

  -- Space cap: read the caller's plan limit; null = unlimited.
  select sp.space_limit into v_limit
  from public.subscription_plans sp
  where sp.slug = v_profile.plan_slug;

  if v_limit is not null then
    select count(*) into v_count from public.spaces where user_id = p_user_id;
    if v_count >= v_limit then
      raise exception 'SPACE_LIMIT_REACHED' using errcode = 'P0001';
    end if;
  end if;

  v_content_type := coalesce(
    p_space_payload->>'content_type',
    case
      when p_space_payload->>'markdown_content' is not null then 'notes'
      when p_space_payload->>'video_url' is not null then 'video'
      when p_space_payload->>'image_url' is not null then 'image'
      when p_space_payload->>'pdf_url' is not null then 'pdf'
      when p_space_payload->>'html_url' is not null then 'html'
      when p_space_payload->>'url' is not null then 'link'
    end
  );

  insert into public.spaces (
    user_id, title, description, url, html_url, pdf_url, image_url, video_url,
    markdown_content, preview_image_url, preview_gradient, preview_title,
    is_public, hashtags, client_request_id, content_type
  )
  values (
    p_user_id,
    p_space_payload->>'title',
    p_space_payload->>'description',
    p_space_payload->>'url',
    p_space_payload->>'html_url',
    p_space_payload->>'pdf_url',
    p_space_payload->>'image_url',
    p_space_payload->>'video_url',
    p_space_payload->>'markdown_content',
    p_space_payload->>'preview_image_url',
    coalesce(p_space_payload->>'preview_gradient', 'violet'),
    p_space_payload->>'preview_title',
    coalesce((p_space_payload->>'is_public')::boolean, true),
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(p_space_payload->'hashtags')),
      '{}'::text[]
    ),
    p_client_request_id,
    v_content_type
  )
  returning id into v_new_space_id;

  return query select v_new_space_id;
end;
$function$;
revoke execute on function public.publish_space_tx(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.publish_space_tx(uuid, jsonb, uuid) to service_role;

-- 4. Column guard + demo claim without the credit balances.
create or replace function public.profiles_protect_columns()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
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
  then
    raise exception 'PROTECTED_COLUMN' using errcode = '42501';
  end if;

  return new;
end;
$function$;

create or replace function public.claim_demo_profile(p_code text, p_merge boolean default false)
 returns table(demo_id uuid, username text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_uid      uuid := auth.uid();
  v_norm     text;
  v_hash     text;
  v_code     public.demo_claim_codes%rowtype;
  v_demo     public.profiles%rowtype;
  v_old      public.profiles%rowtype;
  v_new      public.profiles%rowtype;
  v_merged   boolean := false;
  v_set      text;
  -- Columns that belong to the ACCOUNT, not the showcase profile: on a merge
  -- they keep the caller's values.
  v_keep     text[] := array[
    'id', 'created_at', 'is_admin', 'is_demo', 'support_access_until', 'locale',
    'stripe_customer_id', 'plan_slug',
    'plan_status', 'plan_stripe_subscription_id', 'plan_current_period_end',
    'plan_cancel_at_period_end', 'has_used_trial', 'comp_expires_at',
    'comp_granted_by', 'comp_note'
  ];
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

  select * into v_old from public.profiles where id = v_uid for update;
  if found then
    if not coalesce(p_merge, false) then
      raise exception 'ALREADY_HAS_PROFILE' using errcode = 'P0001';
    end if;
    if v_old.is_demo then
      raise exception 'INVALID_CODE' using errcode = 'P0001';
    end if;
    v_merged := true;
  end if;

  -- One booking widget per catalog entry per user: the demo's configured
  -- instance wins over an unused one of the caller's.
  if v_merged then
    if exists (
      select 1
        from public.widget_instances mine
        join public.widget_instances demo
          on demo.catalog_id = mine.catalog_id and demo.user_id = v_demo.id
        join public.widget_bookings b on b.instance_id = mine.id
       where mine.user_id = v_uid
    ) then
      raise exception 'WIDGET_CONFLICT' using errcode = 'P0001';
    end if;
    delete from public.widget_instances mine
     using public.widget_instances demo
     where mine.user_id = v_uid
       and demo.user_id = v_demo.id
       and demo.catalog_id = mine.catalog_id;
  end if;

  -- Free the username, then put the demo's content onto the claimer's id.
  update public.profiles
     set username = 'demo-claimed-' || replace(v_demo.id::text, '-', '')
   where id = v_demo.id;

  if v_merged then
    -- Demo content columns + the caller's account columns. Columns are read
    -- from the catalog so future profile columns carry over automatically.
    select string_agg(format('%I = r.%I', a.attname, a.attname), ', ')
      into v_set
      from pg_attribute a
     where a.attrelid = 'public.profiles'::regclass
       and a.attnum > 0
       and not a.attisdropped
       and a.attgenerated = ''
       and a.attname <> all (v_keep);

    execute format(
      'update public.profiles t set %s
         from jsonb_populate_record(null::public.profiles, $1) r
        where t.id = $2', v_set)
    using to_jsonb(v_demo) || jsonb_build_object('account_type', 'business'), v_uid;
  else
    v_new := jsonb_populate_record(
      null::public.profiles,
      to_jsonb(v_demo) || jsonb_build_object(
        'id',                          v_uid,
        'is_demo',                     false,
        'is_admin',                    false,
        'created_at',                  now(),
        -- Demos are businesses; a claimed profile must keep the Business
        -- sections (booking, brand, …) regardless of the demo row's value.
        'account_type',                'business',
        -- Booking access is a demo perk (user_has_entitlement), not a plan: the
        -- claimed profile starts on Free with no Stripe/comp state, unless the
        -- code carries a Pro grant (applied as a comp below).
        'plan_slug',                   'free',
        'plan_status',                 null,
        'plan_current_period_end',     null,
        'comp_expires_at',             null,
        'comp_granted_by',             null,
        'comp_note',                   null,
        'plan_stripe_subscription_id', null,
        'plan_cancel_at_period_end',   false,
        'stripe_customer_id',          null,
        'has_used_trial',              false
      )
    );
    insert into public.profiles select (v_new).*;
  end if;

  -- Complimentary Pro chosen by the admin when issuing the code. Same shape
  -- as grant_comp_plan (plan_status='comp', expired by expire_comp_plans).
  -- Never touches a Stripe-paid plan, never shortens an existing comp.
  if coalesce(v_code.grant_pro_days, 0) > 0
     and (not v_merged or v_old.plan_stripe_subscription_id is null)
     and (not v_merged
          or v_old.plan_status is distinct from 'comp'
          or coalesce(v_old.comp_expires_at, '-infinity') < now() + make_interval(days => v_code.grant_pro_days)) then
    update public.profiles set
      plan_slug       = 'pro',
      plan_status     = 'comp',
      comp_expires_at = now() + make_interval(days => v_code.grant_pro_days),
      comp_granted_by = v_code.created_by,
      comp_note       = format('Claim code grant (%s days)', v_code.grant_pro_days)
    where id = v_uid;
  end if;

  -- Re-point the demo's content to the claimer. On a merge, drop the few rows
  -- that would collide with the caller's own unique keys first.
  if v_merged then
    update public.spaces d set client_request_id = null
     where d.user_id = v_demo.id
       and d.client_request_id is not null
       and exists (select 1 from public.spaces m
                    where m.user_id = v_uid and m.client_request_id = d.client_request_id);
    delete from public.profile_views d
     where d.profile_id = v_demo.id
       and exists (select 1 from public.profile_views m
                    where m.profile_id = v_uid
                      and m.visitor_key = d.visitor_key
                      and m.viewed_date = d.viewed_date);
  end if;

  update public.spaces                   set user_id       = v_uid where user_id       = v_demo.id;
  update public.collections              set user_id       = v_uid where user_id       = v_demo.id;
  update public.widget_instances         set user_id       = v_uid where user_id       = v_demo.id;
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
          jsonb_build_object('username', v_demo.username, 'code_id', v_code.id,
                             'grant_pro_days', v_code.grant_pro_days,
                             'merged', v_merged,
                             'previous_username', v_old.username));

  -- Drop the placeholder auth user; cascades the old demo profile row and
  -- whatever is still attached to it (unused codes, mcp tokens, …).
  delete from auth.users where id = v_demo.id;

  return query select v_demo.id, v_demo.username;
end;
$function$;

-- 5. Tables and columns.
drop table if exists public.credit_ledger cascade;
drop table if exists public.credit_packs cascade;
drop table if exists public.llm_usage cascade;
drop table if exists public.llm_models cascade;

alter table public.profiles
  drop column if exists plan_credits,
  drop column if exists paid_credits;

alter table public.subscription_plans
  drop column if exists monthly_credits;

alter table public.widget_catalog
  drop column if exists monthly_credit_limit;
