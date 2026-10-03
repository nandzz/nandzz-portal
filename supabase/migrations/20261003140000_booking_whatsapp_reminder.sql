-- ── Booking WhatsApp reminder (~4h before start, via Twilio) ──────────────────
--
-- A second, WhatsApp-only reminder that rides the same infrastructure as the 24h
-- email reminder (20260826140000): a DB-local cron stamps + enqueues due bookings
-- into a pgmq queue, and the `booking-notifications` edge function drains it.
-- The drain is driven by the EXISTING `booking-notify-drain` */1 heartbeat — the
-- edge fn's `mode:'drain'` now drains this queue too — so no new ping/cron for
-- sending, and no new secrets (Twilio creds are edge-fn secrets).
--
-- Gates (all must hold to enqueue):
--   • app_settings `booking_whatsapp_template`.enabled = true (global switch, set
--     from the nandzz-admin WhatsApp page; seeded OFF so nothing is stamped/burned
--     before an approved Twilio template is configured),
--   • the business hasn't turned it off (widget config `whatsapp_reminder`,
--     default ON when absent),
--   • the customer opted in at booking (`whatsapp_opt_in`, default false so MCP /
--     manual bookings never message without consent),
--   • booking confirmed, has a phone, starts within the next 4h (catch-up window
--     down to 1h if a run was missed), and was booked ≥ 5h ahead (a booking made
--     inside the window already got its confirmation moments ago).
--
-- Every send (reminder or admin test) is recorded in `whatsapp_messages` so the
-- admin can see delivery outcomes and Twilio errors.

-- ── 1. Columns ───────────────────────────────────────────────────────────────
alter table public.widget_bookings
  add column if not exists whatsapp_opt_in boolean not null default false,
  add column if not exists whatsapp_reminder_sent_at timestamptz;

comment on column public.widget_bookings.whatsapp_opt_in is
  'Customer consented (booking-funnel checkbox) to a WhatsApp reminder before the appointment.';
comment on column public.widget_bookings.whatsapp_reminder_sent_at is
  'Stamped when the ~4h WhatsApp reminder was enqueued (single-fire); cleared when the booking is rescheduled.';

create index if not exists widget_bookings_whatsapp_reminder_due_idx
  on public.widget_bookings (starts_at)
  where status = 'confirmed' and whatsapp_opt_in and whatsapp_reminder_sent_at is null;

-- A reschedule moves the appointment, so the reminder must fire again for the
-- new time. BEFORE trigger so it rides the same UPDATE (no extra statement).
create or replace function public.booking_whatsapp_reset_on_reschedule()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.starts_at is distinct from old.starts_at then
    new.whatsapp_reminder_sent_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists booking_whatsapp_reset_on_reschedule on public.widget_bookings;
create trigger booking_whatsapp_reset_on_reschedule
  before update of starts_at on public.widget_bookings
  for each row execute function public.booking_whatsapp_reset_on_reschedule();

-- ── 2. Send log ──────────────────────────────────────────────────────────────
create table if not exists public.whatsapp_messages (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('reminder', 'test')),
  booking_id  uuid references public.widget_bookings(id) on delete set null,
  to_phone    text not null,
  locale      text,
  content_sid text,
  status      text not null default 'queued'
              check (status in ('queued', 'sent', 'failed', 'skipped')),
  twilio_sid  text,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists whatsapp_messages_created_idx
  on public.whatsapp_messages (created_at desc);

-- Service role only (edge fn + admin app). No policies ⇒ no client access.
alter table public.whatsapp_messages enable row level security;

-- ── 3. Template / settings row (seeded OFF) ──────────────────────────────────
-- Shape: { enabled: bool,
--          reminder: { <locale>: { content_sid: "HX…",
--                                  variables: { "1": "customer_first_name", … },
--                                  preview: "Hi {{1}}, …" } } }
-- Locale falls back to `en`. Edited in nandzz-admin → WhatsApp.
insert into public.app_settings (key, value, description)
values (
  'booking_whatsapp_template',
  '{"enabled": false, "reminder": {}}'::jsonb,
  'Booking WhatsApp reminder: global on/off + per-locale approved Twilio Content template (content_sid + placeholder→variable map). Read by the booking-notifications edge function; edit via the nandzz-admin WhatsApp page.'
)
on conflict (key) do nothing;

-- ── 4. pgmq queue + wrappers ─────────────────────────────────────────────────
create extension if not exists pgmq;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'pgmq'
      and c.relname = 'q_booking_whatsapp'
  ) then
    perform pgmq.create('booking_whatsapp');
  end if;
end $$;

create or replace function public.whatsapp_queue_read(p_qty int, p_vt int)
returns table(msg_id bigint, read_ct int, message jsonb)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select r.msg_id, r.read_ct, r.message
    from pgmq.read('booking_whatsapp', p_vt, p_qty) r;
end;
$$;

create or replace function public.whatsapp_queue_delete(p_msg_ids bigint[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_msg_ids is null or array_length(p_msg_ids, 1) is null then
    return;
  end if;
  perform pgmq.delete('booking_whatsapp', p_msg_ids);
end;
$$;

revoke all on function public.whatsapp_queue_read(int, int) from public, anon, authenticated;
revoke all on function public.whatsapp_queue_delete(bigint[]) from public, anon, authenticated;
grant execute on function public.whatsapp_queue_read(int, int) to service_role;
grant execute on function public.whatsapp_queue_delete(bigint[]) to service_role;

-- ── 5. Enqueue due reminders (cron, */5) ─────────────────────────────────────
-- Same single-fire shape as booking_dispatch_reminders: stamp + select in one
-- statement (for update skip locked), then send_batch in the same transaction.
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
        where wb.status = 'confirmed'
          and wb.whatsapp_opt_in
          and wb.whatsapp_reminder_sent_at is null
          and coalesce(btrim(wb.customer_phone), '') <> ''
          and coalesce((wi.config->>'whatsapp_reminder')::boolean, true)
          and wb.created_at <= wb.starts_at - interval '5 hours'
          and wb.starts_at between now() + interval '1 hour'
                               and now() + interval '4 hours'
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

select cron.unschedule('booking-whatsapp-reminders')
  where exists (select 1 from cron.job where jobname = 'booking-whatsapp-reminders');
select cron.schedule(
  'booking-whatsapp-reminders',
  '*/5 * * * *',
  $$select public.booking_dispatch_whatsapp_reminders()$$
);

-- ── 6. Admin test send ───────────────────────────────────────────────────────
-- Called by nandzz-admin (service role). Logs a 'queued' row, enqueues a test
-- job, and pings the drain immediately so the result lands in seconds. Returns
-- the log row id; the admin polls whatsapp_messages for the outcome. Sends
-- regardless of the global `enabled` switch (that's the point of testing).
create or replace function public.admin_whatsapp_test_send(p_to text, p_locale text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if coalesce(btrim(p_to), '') = '' then
    raise exception 'phone is required';
  end if;

  insert into public.whatsapp_messages (kind, to_phone, locale)
  values ('test', btrim(p_to), nullif(btrim(p_locale), ''))
  returning id into v_id;

  perform pgmq.send(
    'booking_whatsapp',
    jsonb_build_object('kind', 'test', 'log_id', v_id)
  );
  perform public.booking_drain_ping();
  return v_id;
end;
$$;

revoke all on function public.admin_whatsapp_test_send(text, text) from public, anon, authenticated;
grant execute on function public.admin_whatsapp_test_send(text, text) to service_role;
