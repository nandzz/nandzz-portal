-- ── Per-business WhatsApp reminder timing ────────────────────────────────────
--
-- The WhatsApp reminder (20261003140000) always fired ~4h before start. Each
-- business now picks the lead time in Services settings: widget config
-- `whatsapp_reminder_hours` ∈ {24, 12, 6, 4}; absent or anything else ⇒ 4, so
-- existing widgets keep today's behavior.
--
-- Window per booking: start within the next H hours (catch-up down to 1h if a
-- run was missed), and booked ≥ H+1 hours ahead (a booking made inside the
-- window just got its confirmation). The edge fn re-checks the same gate at
-- send time (whatsapp.ts → whatsAppReminderHours).

create or replace function public.booking_dispatch_whatsapp_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msgs jsonb[];
begin
  -- Global switch: off ⇒ don't stamp anything (no reminders burned).
  if not coalesce(
    (select (value->>'enabled')::boolean
       from public.app_settings where key = 'booking_whatsapp_template'),
    false
  ) then
    return;
  end if;

  with picked as (
    update public.widget_bookings b
       set whatsapp_reminder_sent_at = now()
     where b.id in (
       select wb.id
         from public.widget_bookings wb
         join public.widget_instances wi on wi.id = wb.instance_id
         cross join lateral (
           select make_interval(hours => case wi.config->>'whatsapp_reminder_hours'
                    when '24' then 24 when '12' then 12 when '6' then 6
                    else 4 end) as lead
         ) h
        where wb.status = 'confirmed'
          and wb.whatsapp_opt_in
          and wb.whatsapp_reminder_sent_at is null
          and coalesce(btrim(wb.customer_phone), '') <> ''
          and coalesce((wi.config->>'whatsapp_reminder')::boolean, true)
          -- Outer bound = the largest option, so the partial index still prunes.
          and wb.starts_at between now() + interval '1 hour'
                               and now() + interval '24 hours'
          and wb.starts_at <= now() + h.lead
          and wb.created_at <= wb.starts_at - h.lead - interval '1 hour'
        for update of wb skip locked
        limit 5000
     )
    returning b.id
  )
  select array_agg(jsonb_build_object('kind', 'reminder', 'booking_id', id))
    into v_msgs
  from picked;

  if v_msgs is not null then
    perform pgmq.send_batch('booking_whatsapp', v_msgs);
  end if;
end;
$$;

revoke all on function public.booking_dispatch_whatsapp_reminders() from public, anon, authenticated;
