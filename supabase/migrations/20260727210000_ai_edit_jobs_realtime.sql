-- Enable Realtime for ai_edit_jobs so clients subscribed via
-- .on("postgres_changes", { table: "ai_edit_jobs" }) actually receive events.
--
-- Without this, only the mount-time fetch works — the AI Edits dropdown
-- indicator and HtmlSpaceEditor's approval banner never observe the
-- pending → processing → done → error transitions in real time.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ai_edit_jobs'
  ) then
    alter publication supabase_realtime add table public.ai_edit_jobs;
  end if;
end;
$$;
