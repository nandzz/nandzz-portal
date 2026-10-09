-- Legal compliance pass (2026-10-06).
--
-- 1. legal_acceptances: an append-only log of which Terms / Privacy version
--    each user accepted and when (GDPR accountability, Art. 7(1)). Written only
--    through accept_legal_terms(), which derives the user from auth.uid().
-- 2. content_reports: DSA Art. 16 notices submitted from /report. Inserted by
--    the server (service role) only — no client access at all.
-- 3. legal_retention_sweep(): daily pg_cron job enforcing the retention periods
--    published in the Privacy Policy and DPA:
--      profile_views / space_views ............ 13 months
--      widget_bookings customer fields ......... anonymised 24 months after the
--                                                appointment ended
--      whatsapp_messages ....................... 24 months
--      content_reports ......................... 24 months

-- ── 1. legal_acceptances ────────────────────────────────────────────────────
create table if not exists public.legal_acceptances (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  document    text not null check (document in ('terms', 'privacy')),
  version     text not null check (char_length(version) between 1 and 32),
  accepted_at timestamptz not null default now()
);

create index if not exists legal_acceptances_user_doc_idx
  on public.legal_acceptances (user_id, document, accepted_at desc);

alter table public.legal_acceptances enable row level security;

drop policy if exists "Users read their own legal acceptances" on public.legal_acceptances;
create policy "Users read their own legal acceptances"
  on public.legal_acceptances for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.legal_acceptances from anon, authenticated;

-- Records acceptance of the given Terms version (and the Privacy Policy
-- acknowledgement that goes with it). Idempotent per (user, document, version).
create or replace function public.accept_legal_terms(p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_doc text;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;
  if p_version is null or char_length(p_version) not between 1 and 32 then
    raise exception 'INVALID_VERSION' using errcode = '22023';
  end if;

  foreach v_doc in array array['terms', 'privacy'] loop
    insert into public.legal_acceptances (user_id, document, version)
    select v_uid, v_doc, p_version
    where not exists (
      select 1 from public.legal_acceptances
      where user_id = v_uid and document = v_doc and version = p_version
    );
  end loop;
end;
$$;

revoke execute on function public.accept_legal_terms(text) from public, anon, authenticated;
grant execute on function public.accept_legal_terms(text) to authenticated, service_role;

-- ── 2. content_reports ──────────────────────────────────────────────────────
create table if not exists public.content_reports (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  url              text not null check (char_length(url) between 1 and 2048),
  reason           text not null check (reason in (
                     'illegal', 'csam', 'ip', 'privacy', 'hate', 'violence',
                     'fraud', 'malware', 'impersonation', 'other')),
  details          text not null check (char_length(details) between 1 and 5000),
  reporter_name    text check (char_length(reporter_name) <= 200),
  reporter_email   text check (char_length(reporter_email) <= 320),
  reporter_user_id uuid references auth.users (id) on delete set null,
  good_faith       boolean not null default false,
  -- Daily-rotating hash of the submitter's IP, used only for rate limiting.
  submitter_key    text,
  status           text not null default 'open'
                     check (status in ('open', 'actioned', 'rejected')),
  resolved_at      timestamptz,
  resolution_note  text
);

create index if not exists content_reports_status_idx
  on public.content_reports (status, created_at desc);
create index if not exists content_reports_submitter_idx
  on public.content_reports (submitter_key, created_at desc);

alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon, authenticated;

-- ── 3. Retention sweep ──────────────────────────────────────────────────────
create or replace function public.legal_retention_sweep()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profile_views where viewed_at < now() - interval '13 months';
  delete from public.space_views   where viewed_at < now() - interval '13 months';

  -- Anonymise booking customers once the appointment is 24 months old. Only
  -- customer columns change, so no booking_notify_* trigger fires.
  update public.widget_bookings
     set customer_name    = '[deleted]',
         customer_email   = '',
         customer_phone   = null,
         customer_address = null,
         notes            = null
   where ends_at < now() - interval '24 months'
     and customer_name is distinct from '[deleted]';

  delete from public.whatsapp_messages where created_at < now() - interval '24 months';
  delete from public.content_reports   where created_at < now() - interval '24 months';
end;
$$;

revoke execute on function public.legal_retention_sweep() from public, anon, authenticated;
grant execute on function public.legal_retention_sweep() to service_role;

select cron.unschedule('legal-retention-sweep')
  where exists (select 1 from cron.job where jobname = 'legal-retention-sweep');
select cron.schedule(
  'legal-retention-sweep',
  '15 3 * * *',
  $$select public.legal_retention_sweep()$$
);
