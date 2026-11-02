-- Owner-marked attendance for a booking: did the client show up? Kept as its
-- own nullable column (not new `status` values) so every existing
-- `status = 'confirmed'` read — availability, revenue, reminders, the segments
-- status mirror and its check constraint — keeps working unchanged.
--   null      ⇒ not marked (default)
--   attended  ⇒ completed
--   no_show   ⇒ the client didn't come
alter table public.widget_bookings
  add column if not exists attendance text
    check (attendance in ('attended', 'no_show'));

comment on column public.widget_bookings.attendance is
  'Owner-marked outcome of a confirmed booking: attended | no_show (null = not marked).';
