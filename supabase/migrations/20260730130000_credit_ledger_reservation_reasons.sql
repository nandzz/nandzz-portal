-- Extend credit_ledger.reason to allow the reservation-model reasons
-- introduced by 20260730120000_ai_edit_credit_reservation.sql. The prior
-- CHECK constraint rejected them, causing reserve_llm_credits to fail with
-- a constraint violation.

alter table public.credit_ledger drop constraint if exists credit_ledger_reason_check;

alter table public.credit_ledger add constraint credit_ledger_reason_check check (reason in (
  'signup_grant',
  'admin_grant',
  'admin_revoke',
  'stripe_purchase',
  'publish_space',
  'llm_agent_chat',
  'llm_page_editor',
  'llm_reservation_hold',
  'llm_reservation_release',
  'llm_reservation_refund',
  'refund',
  'backfill'
));
