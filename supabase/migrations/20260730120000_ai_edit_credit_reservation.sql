-- AI Edit credit reservation model.
--
-- Before: the route did a soft "paid_credits >= 5" pre-check, then the
-- webhook debited real usage after Anthropic replied. Two problems:
--   (a) concurrent requests all pass the same pre-check on the same balance
--       and stack their post-charges → users go deeply negative.
--   (b) if the actual session cost outruns the pre-check floor, the user
--       overdrafts by an unbounded amount.
--
-- After: the route atomically reserves a fixed hold (`credits_reserved`,
-- default 20) via `reserve_llm_credits`. `charge_llm_usage` then settles
-- the delta between the hold and real usage in one atomic step. Error
-- paths trigger an auto-refund of the hold via a status-change trigger.

-- ── Schema ──────────────────────────────────────────────────────────────────
alter table public.ai_edit_jobs
  add column if not exists credits_reserved int not null default 0;

-- ── reserve_llm_credits ─────────────────────────────────────────────────────
-- Atomic pre-check + hold. Idempotent by request_id: a retried route call
-- reusing the same request_id will not double-hold.
create or replace function public.reserve_llm_credits(
  p_user_id    uuid,
  p_amount     int,
  p_request_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile  public.profiles%rowtype;
  v_new_paid int;
begin
  if p_amount <= 0 then
    raise exception 'reservation amount must be positive' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.credit_ledger
    where related_entity_id = p_request_id::text
      and reason = 'llm_reservation_hold'
      and delta < 0
  ) then
    return p_amount;
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0001';
  end if;

  if v_profile.paid_credits < p_amount then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;

  v_new_paid := v_profile.paid_credits - p_amount;
  update public.profiles set paid_credits = v_new_paid where id = p_user_id;

  insert into public.credit_ledger (
    user_id, delta, bucket, reason,
    balance_after_free, balance_after_paid,
    related_entity_type, related_entity_id, metadata
  ) values (
    p_user_id, -p_amount, 'paid', 'llm_reservation_hold',
    v_profile.free_space_credits, v_new_paid,
    'ai_edit_job', p_request_id::text,
    jsonb_build_object('reserved', p_amount)
  );

  return p_amount;
end;
$$;

revoke all on function public.reserve_llm_credits(uuid, int, uuid) from public;
grant execute on function public.reserve_llm_credits(uuid, int, uuid) to service_role;

-- ── refund_llm_reservation ──────────────────────────────────────────────────
-- Releases a hold without settling a charge. Used when a job errors before
-- the LLM billed anything meaningful. Idempotent by request_id.
create or replace function public.refund_llm_reservation(
  p_user_id    uuid,
  p_amount     int,
  p_request_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile  public.profiles%rowtype;
  v_new_paid int;
begin
  if p_amount <= 0 then
    return 0;
  end if;

  if exists (
    select 1 from public.credit_ledger
    where related_entity_id = p_request_id::text
      and reason = 'llm_reservation_refund'
      and delta > 0
  ) then
    return 0;
  end if;

  -- Also skip if a settlement already released this hold (successful charge).
  if exists (
    select 1 from public.credit_ledger
    where related_entity_id = p_request_id::text
      and reason = 'llm_reservation_release'
  ) then
    return 0;
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0001';
  end if;

  v_new_paid := v_profile.paid_credits + p_amount;
  update public.profiles set paid_credits = v_new_paid where id = p_user_id;

  insert into public.credit_ledger (
    user_id, delta, bucket, reason,
    balance_after_free, balance_after_paid,
    related_entity_type, related_entity_id, metadata
  ) values (
    p_user_id, p_amount, 'paid', 'llm_reservation_refund',
    v_profile.free_space_credits, v_new_paid,
    'ai_edit_job', p_request_id::text,
    jsonb_build_object('refunded', p_amount)
  );

  return p_amount;
end;
$$;

revoke all on function public.refund_llm_reservation(uuid, int, uuid) from public;
grant execute on function public.refund_llm_reservation(uuid, int, uuid) to service_role;

-- ── charge_llm_usage (extended) ─────────────────────────────────────────────
-- Adds an optional p_credits_reserved param. When > 0, the caller has already
-- deducted that amount from paid_credits (via reserve_llm_credits); this
-- function returns the hold and applies the real cost atomically. Existing
-- named-arg callers that omit p_credits_reserved keep the original behavior.
create or replace function public.charge_llm_usage(
  p_user_id          uuid,
  p_model_id         uuid,
  p_role             text,
  p_input_tokens     int,
  p_output_tokens    int,
  p_message_id       text,
  p_request_id       uuid,
  p_space_id         uuid default null,
  p_credits_reserved int  default 0
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_model         public.llm_models%rowtype;
  v_credits       int;
  v_reserved      int := coalesce(p_credits_reserved, 0);
  v_profile       public.profiles%rowtype;
  v_after_release int;
  v_new_paid      int;
  v_ledger_reason text;
begin
  if p_role not in ('agent_chat', 'page_editor') then
    raise exception 'invalid role' using errcode = 'P0001';
  end if;

  if p_request_id is not null
     and exists (select 1 from public.llm_usage where request_id = p_request_id) then
    return 0;
  end if;

  select * into v_model from public.llm_models where id = p_model_id;
  if not found then
    raise exception 'model not found' using errcode = 'P0001';
  end if;

  v_credits := ceil(
    (p_input_tokens::numeric  / 1000.0) * v_model.input_credits_per_1k
  + (p_output_tokens::numeric / 1000.0) * v_model.output_credits_per_1k
  )::int;
  if v_credits < 0 then v_credits := 0; end if;

  v_ledger_reason := case p_role
    when 'agent_chat'  then 'llm_agent_chat'
    when 'page_editor' then 'llm_page_editor'
  end;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0001';
  end if;

  v_after_release := v_profile.paid_credits + v_reserved;
  v_new_paid      := v_after_release - v_credits;

  update public.profiles set paid_credits = v_new_paid where id = p_user_id;

  insert into public.llm_usage (
    user_id, model_id, role, input_tokens, output_tokens, credits_charged,
    message_id, request_id, space_id
  ) values (
    p_user_id, p_model_id, p_role, p_input_tokens, p_output_tokens, v_credits,
    p_message_id, p_request_id, p_space_id
  );

  if v_reserved > 0 then
    insert into public.credit_ledger (
      user_id, delta, bucket, reason,
      balance_after_free, balance_after_paid,
      related_entity_type, related_entity_id, metadata
    ) values (
      p_user_id, v_reserved, 'paid', 'llm_reservation_release',
      v_profile.free_space_credits, v_after_release,
      'ai_edit_job', p_request_id::text,
      jsonb_build_object('released', v_reserved)
    );
  end if;

  insert into public.credit_ledger (
    user_id, delta, bucket, reason,
    balance_after_free, balance_after_paid,
    related_entity_type, related_entity_id, metadata
  ) values (
    p_user_id, -v_credits, 'paid', v_ledger_reason,
    v_profile.free_space_credits, v_new_paid,
    'llm_usage', p_request_id::text,
    jsonb_build_object(
      'model_id', p_model_id,
      'model', v_model.provider || '/' || v_model.model_id,
      'input_tokens', p_input_tokens,
      'output_tokens', p_output_tokens,
      'reserved', v_reserved
    )
  );

  return v_credits;
end;
$$;

-- Old signature grants are automatically superseded when the function is
-- replaced with a compatible signature (same name, same required args, new
-- trailing default). Re-grant explicitly to be safe.
revoke all on function public.charge_llm_usage(uuid, uuid, text, int, int, text, uuid, uuid, int) from public;
grant execute on function public.charge_llm_usage(uuid, uuid, text, int, int, text, uuid, uuid, int) to service_role;

-- ── Auto-refund on error ────────────────────────────────────────────────────
-- Any status transition into 'error' releases the hold. Covers every failure
-- path (route insert failure, edge fn HTML fetch failures, session creation
-- failures, invalid HTML, uncaught webhook errors) in one place.
create or replace function public._refund_ai_edit_reservation_on_error()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'error'
     and coalesce(old.status, '') <> 'error'
     and coalesce(new.credits_reserved, 0) > 0
     and new.request_id is not null then
    perform public.refund_llm_reservation(new.user_id, new.credits_reserved, new.request_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_refund_ai_edit_reservation_on_error on public.ai_edit_jobs;
create trigger trg_refund_ai_edit_reservation_on_error
  after update of status on public.ai_edit_jobs
  for each row
  execute function public._refund_ai_edit_reservation_on_error();
