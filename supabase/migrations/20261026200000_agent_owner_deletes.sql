-- My Agent: the owner can delete what the agent recorded, and disconnect the
-- WhatsApp number themselves.
--   • agent_activity: delete single feed entries.
--   • agent_threads: delete a conversation; messages, activity and approvals
--     of that chat go with it (FK on delete cascade).
--   • whatsapp_connections: an owner can only flip status to 'disconnected'.
--     Reconnecting goes through Meta signup, never through this policy.

grant delete on public.agent_activity, public.agent_threads to authenticated;

create policy agent_activity_owner_delete on public.agent_activity
  for delete to authenticated using (owner_user_id = (select auth.uid()));
create policy agent_threads_owner_delete on public.agent_threads
  for delete to authenticated using (owner_user_id = (select auth.uid()));

grant update (status, updated_at) on public.whatsapp_connections to authenticated;

create policy whatsapp_connections_owner_disconnect on public.whatsapp_connections
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()) and status = 'disconnected');
