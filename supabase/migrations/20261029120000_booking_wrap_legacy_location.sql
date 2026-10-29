-- Wrap "legacy" single-site booking configs into one location.
--
-- A calendar widget whose services/staff live at the top level of `config`
-- (no `locations`) books fine on the public profile, but the owner dashboard
-- only opens a location — so those owners land on an empty "add a location"
-- screen and can't see their services or bookings. Demo profiles set up via
-- mcp-admin created exactly this shape.
--
-- For every such widget: move the top-level scope (services, categories,
-- staff, availability, blackout_dates) into a single location `loc_main`
-- named after the business (address = profile address), empty the top level,
-- and stamp that location onto the existing bookings + segments so they stay
-- visible in the location-scoped dashboard. All of an instance's rows move to
-- the same location, so the segments overlap key ('loc:' || location_id) stays
-- consistent and no confirmed booking can newly conflict. Updating
-- location_id/location_name fires no notification trigger.
--
-- mcp-admin's configure_booking_widget now always writes this shape (see
-- supabase/functions/mcp-admin/tools/booking_widget.ts wrapSingleSite).

create temporary table _wrap on commit drop as
select
  wi.id as instance_id,
  coalesce(nullif(left(btrim(p.display_name), 80), ''), p.username) as loc_name,
  nullif(left(btrim(p.address->>'formatted'), 300), '') as loc_address
from public.widget_instances wi
join public.widget_catalog wc on wc.id = wi.catalog_id and wc.slug = 'calendar'
join public.profiles p on p.id = wi.user_id
where jsonb_array_length(coalesce(wi.config->'locations', '[]'::jsonb)) = 0
  and (
    jsonb_array_length(coalesce(wi.config->'services', '[]'::jsonb)) > 0
    or jsonb_array_length(coalesce(wi.config->'staff', '[]'::jsonb)) > 0
  );

update public.widget_instances wi
set config = wi.config || jsonb_build_object(
  'locations', jsonb_build_array(
    jsonb_build_object(
      'id', 'loc_main',
      'name', w.loc_name,
      'services', coalesce(wi.config->'services', '[]'::jsonb),
      'categories', coalesce(wi.config->'categories', '[]'::jsonb),
      'staff', coalesce(wi.config->'staff', '[]'::jsonb),
      'availability', coalesce(wi.config->'availability', '{}'::jsonb),
      'blackout_dates', coalesce(wi.config->'blackout_dates', '[]'::jsonb)
    ) || case when w.loc_address is null then '{}'::jsonb
              else jsonb_build_object('address', w.loc_address) end
  ),
  'services', '[]'::jsonb,
  'categories', '[]'::jsonb,
  'staff', '[]'::jsonb,
  'availability', '{}'::jsonb,
  'blackout_dates', '[]'::jsonb
)
from _wrap w
where wi.id = w.instance_id;

update public.widget_bookings b
set location_id = 'loc_main', location_name = w.loc_name
from _wrap w
where b.instance_id = w.instance_id and b.location_id is null;

update public.widget_booking_segments s
set location_id = 'loc_main'
from _wrap w
where s.instance_id = w.instance_id and s.location_id is null;
