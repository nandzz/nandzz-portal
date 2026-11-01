-- Unclaimed demo profiles are deleted 30 days after they were last pitched
-- (latest claim code, else the demo's creation), files included. Promised in
-- the Privacy Policy (#demo-pages) and the demo page's "why am I seeing this"
-- sheet. The work is done by the `demo-retention` edge function (Storage files
-- need the Storage API); this schedules it daily.

create or replace function public.demo_retention_candidates(p_limit int default 25)
returns table (id uuid, username text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username
    from public.profiles p
   where p.is_demo
     and greatest(
           p.created_at,
           coalesce((select max(c.created_at) from public.demo_claim_codes c where c.profile_id = p.id), p.created_at)
         ) < now() - interval '30 days'
   order by p.created_at
   limit greatest(p_limit, 0);
$$;

revoke execute on function public.demo_retention_candidates(int) from public, anon, authenticated;
grant execute on function public.demo_retention_candidates(int) to service_role;

-- Calls the edge function with the booking-notifications vault entries (same
-- project, same shared secret); no-op where those aren't configured.
create or replace function public.demo_retention_dispatch()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'booking_notify_url' limit 1;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'booking_notify_secret' limit 1;
  if v_url is null then
    return;
  end if;

  perform net.http_post(
    url := replace(v_url, '/booking-notifications', '/demo-retention'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-booking-notify-secret', coalesce(v_secret, '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function public.demo_retention_dispatch() from public, anon, authenticated;

select cron.unschedule('demo-retention')
  where exists (select 1 from cron.job where jobname = 'demo-retention');
select cron.schedule(
  'demo-retention',
  '30 3 * * *',
  $$select public.demo_retention_dispatch()$$
);
