-- Repair calendar widgets whose business timezone is a never-chosen "UTC".
--
-- getOrCreateOwnerCalendar provisions the calendar server-side, where
-- defaultCalendarConfig() sees the server's zone (UTC), so every self-serve
-- calendar started out as "UTC". Owners who then set their location's own
-- timezone booked correctly, but anything reading the business timezone (and
-- any new location left on "Business default") stayed in UTC.
--
-- For each calendar still on "UTC" whose locations all carry the SAME explicit
-- timezone, adopt that timezone as the business default. Locations keep their
-- override, so no booking's displayed time changes. Calendars with no
-- locations, or with locations that disagree / inherit, are left alone (the
-- dashboard adopts the owner's browser zone when they add a location).

with candidates as (
  select wi.id, min(l->>'timezone') as tz
  from public.widget_instances wi
  join public.widget_catalog wc on wc.id = wi.catalog_id and wc.slug = 'calendar'
  cross join jsonb_array_elements(coalesce(wi.config->'locations', '[]'::jsonb)) l
  where wi.config->>'timezone' = 'UTC'
  group by wi.id
  having bool_and(nullif(l->>'timezone', '') is not null)
     and count(distinct l->>'timezone') = 1
)
update public.widget_instances wi
set config = jsonb_set(wi.config, '{timezone}', to_jsonb(c.tz))
from candidates c
where wi.id = c.id
  and c.tz <> 'UTC';
