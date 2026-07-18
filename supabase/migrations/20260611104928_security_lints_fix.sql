-- Security lint fixes (Supabase database-linter)
-- 1) Pin search_path on functions flagged by `function_search_path_mutable`
-- 2) Revoke REST/RPC execute on trigger-only SECURITY DEFINER functions
--    flagged by `anon_security_definer_function_executable` /
--    `authenticated_security_definer_function_executable`.
--
-- These changes do not alter app behavior:
--   - Trigger functions still fire on table triggers (triggers ignore EXECUTE grants).
--   - search_path = public matches the schema where every referenced object lives.

-- ── 1. Pin search_path ────────────────────────────────────────────────────
alter function public.handle_new_user()                       set search_path = public;
alter function public.update_likes_count()                    set search_path = public;
alter function public.agent_documents_set_updated_at()        set search_path = public;
alter function public.match_agent_chunks(uuid, vector, integer) set search_path = public;
alter function public.update_follow_counts()                  set search_path = public;
alter function public.update_comment_likes_count()            set search_path = public;
alter function public.update_space_comments_count()           set search_path = public;
alter function public.update_views_count()                    set search_path = public;
alter function public.get_user_id_by_verified_phone(text)     set search_path = public;

-- ── 2. Lock down trigger-only SECURITY DEFINER functions ──────────────────
-- These are invoked by row triggers, not RPC. Revoking REST access removes
-- them from PostgREST's exposed RPC surface.
revoke execute on function public.handle_new_user()                from public, anon, authenticated;
revoke execute on function public.update_likes_count()             from public, anon, authenticated;
revoke execute on function public.update_follow_counts()           from public, anon, authenticated;
revoke execute on function public.update_comment_likes_count()     from public, anon, authenticated;
revoke execute on function public.update_space_comments_count()    from public, anon, authenticated;
revoke execute on function public.update_views_count()             from public, anon, authenticated;
