-- Scale fixes for the follow system.
--
-- 1. Following feed as an RPC: the follow set is resolved by a subquery inside
--    Postgres (no more shipping every followed id to Node and back as a giant
--    IN list), keyset-paginated on (created_at, id) with no exact count.
-- 2. Follow counters no longer serialize on hot profile rows: the trigger only
--    updates a profile row it can lock right away; under contention it records
--    a delta instead, and a 1-minute cron folds the deltas into profiles.

-- ── 1. following feed ───────────────────────────────────────────────────────
create index if not exists spaces_public_user_created_idx
  on public.spaces (user_id, created_at desc, id desc)
  where is_public;

-- Security invoker: spaces RLS still applies. Cursor direction:
--   p_before_* → the page OLDER than the cursor (newest first)
--   p_after_*  → the page NEWER than the cursor (returned oldest first; the
--                caller reverses it)
-- Callers pass p_limit = page size + 1 to learn whether another page exists.
create or replace function public.get_following_feed(
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 26
)
returns setof public.spaces
language sql
stable
security invoker
set search_path = public
as $$
  select s.*
  from public.spaces s
  where s.is_public
    -- Feed is publications + photos only; legacy null content_type = publication.
    and (s.content_type is null or s.content_type not in ('link', 'video'))
    and s.user_id in (
      select f.following_id
      from public.user_follows f
      where f.follower_id = (select auth.uid())
    )
    and (p_before_created_at is null
         or (s.created_at, s.id) < (p_before_created_at, p_before_id))
    and (p_after_created_at is null
         or (s.created_at, s.id) > (p_after_created_at, p_after_id))
  order by
    case when p_after_created_at is null then s.created_at end desc,
    case when p_after_created_at is null then s.id end desc,
    case when p_after_created_at is not null then s.created_at end asc,
    case when p_after_created_at is not null then s.id end asc
  limit least(greatest(coalesce(p_limit, 26), 1), 101);
$$;

revoke execute on function public.get_following_feed(timestamptz, uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function public.get_following_feed(timestamptz, uuid, timestamptz, uuid, integer) to authenticated;

-- ── 2. follow counters ──────────────────────────────────────────────────────
-- No FK on purpose: a profile deletion cascades into user_follows, whose
-- trigger may record a delta for the profile being deleted; the drain simply
-- skips ids with no profile.
create table if not exists public.follow_count_deltas (
  id bigint generated always as identity primary key,
  profile_id uuid not null,
  followers_delta integer not null default 0,
  following_delta integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.follow_count_deltas enable row level security;
revoke all on public.follow_count_deltas from anon, authenticated;

-- Apply one counter change: update the profile row if it can be locked now
-- (the common case — counts stay immediate), else queue a delta so a burst of
-- follows on a popular profile never waits on that row's lock.
create or replace function public.bump_follow_count(
  p_profile_id uuid,
  p_followers_delta integer,
  p_following_delta integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.profiles p
  set followers_count = greatest(0, coalesce(p.followers_count, 0) + p_followers_delta),
      following_count = greatest(0, coalesce(p.following_count, 0) + p_following_delta)
  where p.id = (
    select id from public.profiles where id = p_profile_id
    for update skip locked
  );
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    insert into public.follow_count_deltas (profile_id, followers_delta, following_delta)
    values (p_profile_id, p_followers_delta, p_following_delta);
  end if;
end;
$$;

revoke execute on function public.bump_follow_count(uuid, integer, integer) from public, anon, authenticated;

create or replace function public.update_follow_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    perform public.bump_follow_count(NEW.following_id, 1, 0);
    perform public.bump_follow_count(NEW.follower_id, 0, 1);
  elsif TG_OP = 'DELETE' then
    perform public.bump_follow_count(OLD.following_id, -1, 0);
    perform public.bump_follow_count(OLD.follower_id, 0, -1);
  end if;
  return null;
end;
$$;

revoke execute on function public.update_follow_counts() from public, anon, authenticated;

-- Fold queued deltas into profiles, one UPDATE per profile per run. DELETE …
-- RETURNING only takes rows visible to this snapshot; later inserts wait for
-- the next run.
create or replace function public.apply_follow_count_deltas()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with drained as (
    delete from public.follow_count_deltas
    returning profile_id, followers_delta, following_delta
  ), agg as (
    select profile_id,
           sum(followers_delta)::integer as fd,
           sum(following_delta)::integer as gd
    from drained
    group by profile_id
  )
  update public.profiles p
  set followers_count = greatest(0, coalesce(p.followers_count, 0) + agg.fd),
      following_count = greatest(0, coalesce(p.following_count, 0) + agg.gd)
  from agg
  where p.id = agg.profile_id
    and (agg.fd <> 0 or agg.gd <> 0);
end;
$$;

revoke execute on function public.apply_follow_count_deltas() from public, anon, authenticated;
grant execute on function public.apply_follow_count_deltas() to service_role;

select cron.unschedule('apply-follow-count-deltas')
  where exists (select 1 from cron.job where jobname = 'apply-follow-count-deltas');
select cron.schedule(
  'apply-follow-count-deltas',
  '* * * * *',
  $$select public.apply_follow_count_deltas()$$
);
