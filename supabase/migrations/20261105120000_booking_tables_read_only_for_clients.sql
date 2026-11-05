-- Booking rows are written ONLY by the service role (Next routes) and by
-- SECURITY DEFINER RPCs. Clients (anon / authenticated) only read their own
-- rows: the owner dashboard and the realtime subscription.
--
-- The old "owner_all_*" policies allowed INSERT/UPDATE/DELETE whenever
-- owner_user_id = auth.uid(), but never tied instance_id to that owner. Any
-- signed-in user could therefore insert a confirmed segment on ANOTHER
-- business's instance (instance ids are public) and block its whole calendar
-- through the overlap constraint, or insert a confirmed booking that fires a
-- notification email branded as that business.

revoke insert, update, delete on public.widget_bookings from anon, authenticated;
revoke insert, update, delete on public.widget_booking_segments from anon, authenticated;

drop policy if exists owner_all_widget_bookings on public.widget_bookings;
create policy owner_read_widget_bookings on public.widget_bookings
  for select using ((select auth.uid()) = owner_user_id);

drop policy if exists owner_all_widget_booking_segments on public.widget_booking_segments;
create policy owner_read_widget_booking_segments on public.widget_booking_segments
  for select using ((select auth.uid()) = owner_user_id);
