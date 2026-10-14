-- ── booking_drain_ping: skip the edge-function call when both queues are empty ─
--
-- WHY: the `booking-notify-drain` cron fires every minute and used to ALWAYS
-- net.http_post the booking-notifications edge function, even with nothing to
-- send (≈1440 invocations/day, almost all no-ops). Now it first checks, locally,
-- whether either pgmq queue has a VISIBLE message (vt <= now()) and returns
-- early if not. Messages a worker has read but not yet deleted are invisible
-- until their vt expires, so retries still get picked up on a later tick.
--
-- Body otherwise identical to 20260826140000. admin_whatsapp_test_send() enqueues
-- before calling this, so its immediate ping still goes through.
create or replace function public.booking_drain_ping()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  if not exists (select 1 from pgmq.q_booking_notifications where vt <= now())
     and not exists (select 1 from pgmq.q_booking_whatsapp where vt <= now()) then
    return;  -- nothing to drain: don't wake the edge function
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'booking_notify_url' limit 1;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'booking_notify_secret' limit 1;

  if v_url is null then
    return;  -- environment not configured yet: no-op
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-booking-notify-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object('mode', 'drain')
  );
end;
$$;

revoke all on function public.booking_drain_ping() from public, anon, authenticated;
