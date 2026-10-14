-- Owner-granted support access for the admin MCP.
--
-- A real (non-demo) account can be edited by the admin MCP (mcp-admin) only
-- while profiles.support_access_until is in the future. The owner turns it on
-- from Settings (7 days) and can revoke it at any time. The column is
-- protected so a user can't set an arbitrary expiry with a direct UPDATE —
-- only set_support_access() writes it.

alter table public.profiles
  add column if not exists support_access_until timestamptz;

-- Re-declare the protected-columns guard with support_access_until added.
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

-- Grant (7 days from now) or revoke support access on the caller's own
-- profile. Returns the new expiry (null when revoked).
create or replace function public.set_support_access(p_enabled boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_until timestamptz := case when p_enabled then now() + interval '7 days' else null end;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  update public.profiles set support_access_until = v_until where id = v_uid;
  if not found then
    raise exception 'NO_PROFILE' using errcode = 'P0002';
  end if;
  return v_until;
end;
$$;

revoke all on function public.set_support_access(boolean) from public, anon;
grant execute on function public.set_support_access(boolean) to authenticated, service_role;
