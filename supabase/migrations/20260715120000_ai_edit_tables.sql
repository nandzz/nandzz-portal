-- ai_edit_requests / ai_edit_jobs
-- Reconciled from prod drift: tables existed on prod but were never checked into
-- migrations. space-ai-edit + anthropic-webhook edge functions write to ai_edit_jobs.

create table if not exists public.ai_edit_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  space_id    uuid not null references public.spaces(id) on delete cascade,
  instruction text not null,
  success     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists ai_edit_requests_user_date_idx
  on public.ai_edit_requests(user_id, created_at desc);

alter table public.ai_edit_requests enable row level security;

drop policy if exists "Users can read own ai edit requests" on public.ai_edit_requests;
create policy "Users can read own ai edit requests"
  on public.ai_edit_requests for select
  using (auth.uid() = user_id);

drop policy if exists "Service role can insert ai edit requests" on public.ai_edit_requests;
create policy "Service role can insert ai edit requests"
  on public.ai_edit_requests for insert
  with check (auth.uid() = user_id);

create table if not exists public.ai_edit_jobs (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  instruction  text not null,
  html_url     text not null,
  session_id   text,
  status       text not null default 'pending',
  status_text  text,
  chars        integer not null default 0,
  result_html  text,
  error_code   text,
  created_at   timestamptz not null default now(),
  file_context jsonb
);

create index if not exists ai_edit_jobs_user_date_idx
  on public.ai_edit_jobs(user_id, created_at desc);

alter table public.ai_edit_jobs enable row level security;

drop policy if exists "Users can read own ai edit jobs" on public.ai_edit_jobs;
create policy "Users can read own ai edit jobs"
  on public.ai_edit_jobs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own ai edit jobs" on public.ai_edit_jobs;
create policy "Users can delete own ai edit jobs"
  on public.ai_edit_jobs for delete
  using (auth.uid() = user_id);
