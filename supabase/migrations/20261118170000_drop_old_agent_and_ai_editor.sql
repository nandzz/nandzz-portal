-- Remove the old AI agent (public chat + agent widget) and the AI page editor
-- (Felipe, 2026-11-18). The current Business Agent (agent_settings /
-- agent_threads / agent_messages / agent_activity / agent_approvals) and its
-- knowledge base (agent_documents / agent_document_chunks / match_agent_chunks,
-- embed-document) stay. The shared LLM credit tables/RPCs and their historic
-- ledger reasons are kept untouched.

-- Old agent: request log, per-instance billing, rate limiter, widget, columns.
drop table if exists public.agent_requests cascade;
drop function if exists public.charge_agent_usage(uuid, uuid, uuid, integer, integer, uuid);
drop function if exists public.assert_chat_rate_limit(text, integer, integer);
drop table if exists public.chat_rate_limits cascade;
delete from public.app_settings where key = 'chat_rate_limit';

-- widget_instances cascade from the catalog row (0 instances on dev/prod).
delete from public.widget_catalog where slug = 'agent';

alter table public.profiles
  drop column if exists agent_enabled,
  drop column if exists agent_suggested_questions;

-- AI page editor: job tables (also leaves the realtime publication).
drop table if exists public.ai_edit_jobs cascade;
drop table if exists public.ai_edit_requests cascade;
drop function if exists public._refund_ai_edit_reservation_on_error();

-- No notification type for AI edits any more (0 rows on dev/prod).
delete from public.notifications where type = 'ai_edit_ready';
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array['new_booking'::text, 'booking_cancelled'::text, 'booking_rescheduled'::text]));
