-- ── Booking emails: no false "rescheduled" on create + multi-service/staff ─────
--
-- 1. Bug: every new widget booking also sent a "rescheduled" email (owner got
--    "customer rescheduled"). create_booking_tx's segment path (20260901120000)
--    INSERTs the parent row with staff_id null, places the segments, then
--    UPDATEs the parent's staff_id in the SAME transaction — and the update
--    trigger read that null→staff change as a reschedule. Fix: an UPDATE in the
--    same transaction that inserted the row is the creation finishing, not a
--    reschedule. created_at defaults to now() (= transaction start), so
--    `OLD.created_at = now()` identifies it exactly.
--
-- 2. Templates: the details card showed one "Service" row (services joined with
--    " + ") and one "With" row (only the primary staff). Replace both with the
--    {{services}} rows (each service + its own staff member, rendered by the
--    edge function) under a singular/plural label driven by the
--    {{#single_service}}/{{#multi_service}} section flags. Applied as an
--    in-place regex rewrite of each template so admin edits elsewhere are kept;
--    a template whose rows were customised (no match) is left untouched.

-- ── 1. booking_notify_updated (faithful to 20260901120000 + same-tx guard) ────
create or replace function public.booking_notify_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event  text;
  v_url    text;
  v_secret text;
begin
  if OLD.status is distinct from 'cancelled' and NEW.status = 'cancelled' then
    v_event := 'cancelled';
  elsif NEW.status = 'confirmed'
    and (NEW.starts_at is distinct from OLD.starts_at
         or NEW.staff_id is distinct from OLD.staff_id) then
    -- Row inserted in this same transaction (create_booking_tx syncing the
    -- assigned staff onto the parent): part of the creation, not a reschedule.
    if OLD.created_at = now() then
      return NEW;
    end if;
    v_event := 'rescheduled';
  else
    return NEW;  -- not a notifiable change
  end if;

  -- Internal-only change (e.g. owner reassigned a service's staff): stay quiet.
  if coalesce(NEW.notify_actor, '') = 'silent' then
    return NEW;
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'booking_notify_url' limit 1;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'booking_notify_secret' limit 1;

  if v_url is null then
    return NEW;  -- environment not configured yet: no-op
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-booking-notify-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object(
      'booking_id', NEW.id,
      'event', v_event,
      'actor', coalesce(nullif(NEW.notify_actor, ''), 'customer')
    )
  );

  return NEW;
end;
$$;

-- ── 2. Templates: Service + With rows → {{services}} ─────────────────────────
do $$
declare
  v_tpl    jsonb;
  v_aud    text;
  v_kind   text;
  v_loc    text;
  v_html   text;
  v_plural text;
begin
  select value into v_tpl from public.app_settings where key = 'booking_email_template';
  if v_tpl is null then
    return;
  end if;

  for v_aud in select jsonb_object_keys(v_tpl) loop
    for v_kind in select jsonb_object_keys(v_tpl->v_aud) loop
      for v_loc in select jsonb_object_keys(v_tpl->v_aud->v_kind) loop
        v_html := v_tpl->v_aud->v_kind->v_loc->>'html';
        continue when v_html is null;

        v_plural := case v_loc
          when 'pt' then 'Serviços'
          when 'fr' then 'Services'
          when 'es' then 'Servicios'
          when 'ja' then 'サービス'
          when 'de' then 'Leistungen'
          when 'it' then 'Servizi'
          else 'Services'
        end;

        -- Label + {{service}} value rows → plural-aware label + {{services}} rows.
        v_html := regexp_replace(
          v_html,
          '(<tr><td style="padding:14px 0 2px;[^"]*">)([^<]*)(</td></tr>)\s*<tr><td style="padding:0 0 2px;[^"]*">\{\{service\}\}</td></tr>',
          '\1{{#single_service}}\2{{/single_service}}{{#multi_service}}' || v_plural || '{{/multi_service}}\3' || E'\n      ' || '{{services}}'
        );

        -- Drop the standalone "With {{staff}}" section (staff now sits under each service).
        v_html := regexp_replace(
          v_html,
          '\{\{#staff\}\}[^{]*\{\{staff\}\}[^{]*\{\{/staff\}\}\s*',
          ''
        );

        v_tpl := jsonb_set(v_tpl, array[v_aud, v_kind, v_loc, 'html'], to_jsonb(v_html));
      end loop;
    end loop;
  end loop;

  update public.app_settings
     set value = v_tpl,
         updated_at = now()
   where key = 'booking_email_template';
end;
$$;
