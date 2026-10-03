-- ── Lock the booking reminder queue/cron functions to service_role ───────────
--
-- 20260824150000 / 20260826140000 revoked these SECURITY DEFINER functions from
-- PUBLIC only, but Supabase's default privileges also grant EXECUTE directly to
-- `anon` and `authenticated`, so anyone holding the public anon key could call
-- them over PostgREST: read (hide) or delete queued reminder emails, force the
-- reminder scan, or spam the edge-function drain ping. Verified on dev:
-- `rpc/booking_queue_read` with the anon key returned 200 instead of 42501.
--
-- Callers are unaffected: the edge function uses service_role, and pg_cron runs
-- as postgres (owner).

revoke all on function public.booking_queue_read(int, int) from public, anon, authenticated;
revoke all on function public.booking_queue_delete(bigint[]) from public, anon, authenticated;
revoke all on function public.booking_queue_archive(bigint[]) from public, anon, authenticated;
revoke all on function public.booking_dispatch_reminders() from public, anon, authenticated;
revoke all on function public.booking_drain_ping() from public, anon, authenticated;

grant execute on function public.booking_queue_read(int, int) to service_role;
grant execute on function public.booking_queue_delete(bigint[]) to service_role;
grant execute on function public.booking_queue_archive(bigint[]) to service_role;
