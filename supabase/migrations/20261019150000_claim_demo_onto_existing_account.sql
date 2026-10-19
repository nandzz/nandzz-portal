-- Claiming a demo profile with an account that ALREADY has a profile.
--
-- Businesses were getting lost mid-claim: the email-confirmation link didn't
-- bring them back to /claim, so they signed up again through the normal flow,
-- got a username/profile, and from then on claim_demo_profile rejected them
-- with ALREADY_HAS_PROFILE. Now the claimer can pass p_merge = true to take
-- over the demo with their existing account:
--
-- - The caller's profile row is kept (same id → followers, follows, likes,
--   comments, tokens… all stay) and its public/content columns are overwritten
--   with the demo's (username, bio, avatar, brand, layout, address, …).
-- - Account-level state stays the caller's: plan/Stripe/comp/credits, trial
--   flag, follower counters, locale, admin/support flags.
-- - The demo's spaces/collections/widgets/bookings/views move onto the caller
--   NEXT TO the caller's own content (nothing of theirs is deleted), except a
--   widget instance of the same catalog entry: the demo's (configured) one
--   replaces the caller's, unless the caller's has bookings → WIDGET_CONFLICT.
-- - The code's Pro grant applies unless the caller pays through Stripe; it
--   never shortens an existing comp.
--
-- The no-profile path (p_merge ignored) is unchanged from 20261018140000.

drop function if exists public.claim_demo_profile(text);

create or replace function public.claim_demo_profile(p_code text, p_merge boolean default false)
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
  v_old      public.profiles%rowtype;
  v_new      public.profiles%rowtype;
  v_merged   boolean := false;
  v_set      text;
  -- Columns that belong to the ACCOUNT, not the showcase profile: on a merge
  -- they keep the caller's values.
  v_keep     text[] := array[
    'id', 'created_at', 'is_admin', 'is_demo', 'support_access_until', 'locale',
    'stripe_customer_id', 'paid_credits', 'plan_credits', 'plan_slug',
    'plan_status', 'plan_stripe_subscription_id', 'plan_current_period_end',
    'plan_cancel_at_period_end', 'has_used_trial', 'comp_expires_at',
    'comp_granted_by', 'comp_note', 'followers_count', 'following_count'
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
    perform public.refill_plan_credits(v_uid, 'pro');
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
$$;

revoke all on function public.claim_demo_profile(text, boolean) from public, anon;
grant execute on function public.claim_demo_profile(text, boolean) to authenticated;
