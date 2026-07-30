-- Wire AI edit jobs into the same credit/token-usage pipeline as agent chat.
-- The DB was already prepared for the "page_editor" role (llm_models seed,
-- charge_llm_usage, llm_usage.role check) — this migration finishes the plumbing:
--   1. Add model_id + request_id to ai_edit_jobs so the webhook knows what to
--      charge and can stay idempotent under retries.
--   2. Activate the seeded claude-sonnet-4-6 page_editor model row.

alter table public.ai_edit_jobs
  add column if not exists model_id   uuid references public.llm_models(id) on delete set null,
  add column if not exists request_id uuid;

-- request_id doubles as the idempotency key handed to charge_llm_usage.
create unique index if not exists ai_edit_jobs_request_uniq
  on public.ai_edit_jobs(request_id)
  where request_id is not null;

update public.llm_models
   set active     = true,
       updated_at = now()
 where default_for_role = 'page_editor'
   and provider         = 'anthropic'
   and model_id         = 'claude-sonnet-4-6'
   and active           = false;
