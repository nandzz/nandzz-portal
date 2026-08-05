-- Enable Realtime for widget_bookings so the owner dashboard can react to new
-- bookings arriving live via .on("postgres_changes", { table: "widget_bookings" }).
--
-- Without this, the Bookings tab's "new today" chip never lights up — the
-- WidgetWorkspace subscription would connect but receive no INSERT payloads.
-- Default replica identity is sufficient: we only consume INSERT `new` rows,
-- not UPDATE/DELETE `old` images. RLS (owner_all_widget_bookings) still scopes
-- delivery to the authenticated owner's rows.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'widget_bookings'
  ) then
    alter publication supabase_realtime add table public.widget_bookings;
  end if;
end;
$$;
