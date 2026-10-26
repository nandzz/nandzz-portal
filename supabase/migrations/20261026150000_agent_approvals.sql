-- Business Agent: owner approval flow.
--
-- The owner approves or rejects a pending request from My Agent → Activity.
-- The portal (server action, service role) claims the approval atomically
-- (status pending → approved/rejected), re-checks and executes it with the same
-- booking logic as the web routes, and marks it failed when the slot is gone.
-- It then pings the worker, which reads the outcome through agent_api.get_approval
-- (scoped to the customer's own chat) and tells the customer.

alter table public.agent_approvals
  add column if not exists outcome text check (outcome in ('slot_taken', 'out_of_hours', 'booking_gone', 'error'));

alter table public.agent_activity drop constraint if exists agent_activity_kind_check;
alter table public.agent_activity add constraint agent_activity_kind_check check (kind in (
  'booking_created', 'booking_rescheduled', 'booking_cancelled',
  'approval_requested', 'approval_rejected', 'approval_failed', 'hand_off'));

-- The decided request, for the worker to word the customer's message. Only
-- approvals of this chat; minimal fields.
create or replace function agent_api.get_approval(p_token text, p_approval_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sc   record;
  a    public.agent_approvals%rowtype;
  b    public.widget_bookings%rowtype;
  cfg  jsonb;
  tz   text;
  loc  text;
  starts_at timestamptz;
  service   text;
begin
  select * into sc from agent_private.resolve_scope(p_token, 'get_approval');
  select * into a from public.agent_approvals
  where id = p_approval_id and thread_id = sc.thread_id and owner_user_id = sc.owner_user_id;
  if not found then
    raise exception 'APPROVAL_NOT_FOUND' using errcode = 'P0001';
  end if;

  if a.booking_id is not null then
    select * into b from public.widget_bookings where id = a.booking_id;
  end if;
  select wi.config into cfg from public.widget_instances wi where wi.id = sc.instance_id;
  loc := coalesce(a.request->>'location_id', b.location_id);
  tz := coalesce(
    (select l->>'timezone' from jsonb_array_elements(coalesce(cfg->'locations', '[]'::jsonb)) l where l->>'id' = loc),
    cfg->>'timezone');

  starts_at := coalesce((a.request->>'starts_at')::timestamptz, b.starts_at);
  service := coalesce(b.service_name, (
    select string_agg(s->>'name', ' + ')
    from jsonb_array_elements_text(coalesce(a.request->'service_ids', '[]'::jsonb)) sid
    join lateral (
      select s from jsonb_array_elements(coalesce(
        (select l->'services' from jsonb_array_elements(coalesce(cfg->'locations', '[]'::jsonb)) l where l->>'id' = loc),
        cfg->'services', '[]'::jsonb)) s
      where s->>'id' = sid limit 1
    ) x on true
  ));

  return jsonb_build_object(
    'kind', a.kind,
    'status', a.status,
    'outcome', a.outcome,
    'service', service,
    'when', agent_private.fmt_when(starts_at, tz),
    'staff', b.staff_name,
    'location', b.location_name
  );
end;
$$;

revoke all on function agent_api.get_approval(text, uuid) from public, anon, authenticated;
grant execute on function agent_api.get_approval(text, uuid) to agent_runtime;
