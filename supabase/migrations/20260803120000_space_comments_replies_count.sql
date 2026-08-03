-- space_comments.replies_count: server-authoritative count of direct child
-- replies per top-level comment. Mirrors the likes_count pattern in the
-- initial schema so the client can decide whether to render the
-- "view replies" toggle without a per-comment fan-out query.

alter table public.space_comments
  add column if not exists replies_count integer not null default 0;

-- Backfill from existing data.
update public.space_comments p
set replies_count = sub.cnt
from (
  select parent_id, count(*)::int as cnt
  from public.space_comments
  where parent_id is not null
  group by parent_id
) sub
where sub.parent_id = p.id;

-- Trigger: keep replies_count in sync on child insert/delete.
create or replace function public.update_comment_replies_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.parent_id is not null then
      update public.space_comments
        set replies_count = replies_count + 1
        where id = NEW.parent_id;
    end if;
    return NEW;
  elsif TG_OP = 'DELETE' then
    if OLD.parent_id is not null then
      update public.space_comments
        set replies_count = greatest(0, replies_count - 1)
        where id = OLD.parent_id;
    end if;
    return OLD;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.update_comment_replies_count() from public, anon, authenticated;

drop trigger if exists on_comment_reply_change on public.space_comments;
create trigger on_comment_reply_change
  after insert or delete on public.space_comments
  for each row execute procedure public.update_comment_replies_count();
