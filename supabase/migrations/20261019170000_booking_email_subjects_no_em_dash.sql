-- Booking email subjects: replace " — " with natural punctuation (": ", or the
-- full-width "：" for Japanese). Only subjects carry em dashes; html is untouched.
update public.app_settings s
set value = (
  select jsonb_object_agg(a.key, (
    select jsonb_object_agg(k.key, (
      select jsonb_object_agg(l.key,
        case when l.value ? 'subject' then jsonb_set(
          l.value, '{subject}',
          to_jsonb(replace(l.value->>'subject', ' — ', case when l.key = 'ja' then '：' else ': ' end))
        ) else l.value end)
      from jsonb_each(k.value) l))
    from jsonb_each(a.value) k))
  from jsonb_each(s.value) a)
where s.key = 'booking_email_template';
