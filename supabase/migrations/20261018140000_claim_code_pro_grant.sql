-- Claim codes can carry a complimentary Pro grant, and a claimed profile is
-- always a Business account. Before this, claimed profiles landed on Free +
-- 'personal', so the booking button vanished the moment the business claimed.
--
-- grant_pro_days: null = no grant. Chosen per code by the admin (nandzz-admin
-- /users/demo or mcp-admin create_claim_code). comp_granted_by may be null
-- (nandzz-admin codes have no created_by — admin ids differ across projects).

alter table public.demo_claim_codes
  add column if not exists grant_pro_days int
    check (grant_pro_days is null or grant_pro_days between 1 and 365);

-- Same as 20261018130000 plus account_type='business' and the Pro grant.
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

  -- Complimentary Pro chosen by the admin when issuing the code. Same shape
  -- as grant_comp_plan (plan_status='comp', expired by expire_comp_plans).
  if coalesce(v_code.grant_pro_days, 0) > 0 then
    update public.profiles set
      plan_slug       = 'pro',
      plan_status     = 'comp',
      comp_expires_at = now() + make_interval(days => v_code.grant_pro_days),
      comp_granted_by = v_code.created_by,
      comp_note       = format('Claim code grant (%s days)', v_code.grant_pro_days)
    where id = v_uid;
    perform public.refill_plan_credits(v_uid, 'pro');
  end if;

  -- Re-point the demo's content to the claimer.
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
                             'grant_pro_days', v_code.grant_pro_days));

  -- Drop the placeholder auth user; cascades the old demo profile row and
  -- whatever is still attached to it (unused codes, mcp tokens, …).
  delete from auth.users where id = v_demo.id;

  return query select v_demo.id, v_demo.username;
end;
$$;

revoke all on function public.claim_demo_profile(text) from public, anon;
grant execute on function public.claim_demo_profile(text) to authenticated;
