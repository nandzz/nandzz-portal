-- ── Drop the space comments feature ─────────────────────────────────────────
-- Comments are no longer offered (likes stay). Removes the comment tables,
-- their counter triggers/functions, `spaces.comments_count`, and the comment
-- notification types. Only the trigger functions below referenced these
-- objects (checked against dev + prod).

drop table if exists public.comment_mentions;
drop table if exists public.comment_likes;
drop table if exists public.space_comments;  -- drops on_comment_change / on_comment_reply_change

drop function if exists public.update_comment_likes_count();
drop function if exists public.update_space_comments_count();
drop function if exists public.update_comment_replies_count();

alter table public.spaces drop column if exists comments_count;

delete from public.notifications where type in ('new_comment', 'new_reply', 'comment_mention');

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('ai_edit_ready', 'new_booking'));
