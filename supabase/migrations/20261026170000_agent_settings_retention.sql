-- My Agent → Settings: per-business message retention (max 1 year). Message
-- content (incl. voice transcripts) older than the window is purged daily;
-- bookings, approvals and the activity feed stay.

alter table public.agent_settings
  add column if not exists retention_months int not null default 6
    check (retention_months in (1, 3, 6, 12));

select cron.schedule(
  'agent-purge-old-messages',
  '20 3 * * *',
  $$delete from public.agent_messages m
    using (
      select t.id, coalesce(s.retention_months, 6) as months
      from public.agent_threads t
      left join public.agent_settings s on s.owner_user_id = t.owner_user_id
    ) r
    where m.thread_id = r.id and m.created_at < now() - make_interval(months => r.months)$$
);
