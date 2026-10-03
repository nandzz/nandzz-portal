-- =====================================================
-- Content analytics aggregated in SQL
-- =====================================================
--
-- The dashboard used to pull every space + every raw space_views row in the
-- window into Next and count in JS — unbounded for large accounts, and wrong
-- past PostgREST's row cap. These two functions replace that. Both are called
-- only through the service role (admin client).

-- Summary + chart series for all of a user's spaces, or one space when
-- p_space_id is set. `p_bounds` = chart bucket boundaries (n buckets → n+1
-- timestamps); `series` is the per-bucket view count, in order.
create or replace function public.space_view_stats(
  p_user_id uuid,
  p_bounds timestamptz[],
  p_space_id uuid default null
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with s as (
    select id, views_count, likes_count
    from public.spaces
    where user_id = p_user_id
      and (p_space_id is null or id = p_space_id)
  ),
  v as (
    select sv.viewed_at
    from public.space_views sv
    join s on s.id = sv.space_id
    where sv.viewed_at >= least(p_bounds[1], now() - interval '30 days')
  ),
  b as (
    select i, p_bounds[i] as st, p_bounds[i + 1] as en
    from generate_series(1, array_length(p_bounds, 1) - 1) as i
  )
  select jsonb_build_object(
    'total_views', (select coalesce(sum(views_count), 0) from s),
    'total_likes', (select coalesce(sum(likes_count), 0) from s),
    'views7d',     (select count(*) from v where viewed_at >= now() - interval '7 days'),
    'views30d',    (select count(*) from v where viewed_at >= now() - interval '30 days'),
    'series', (
      select coalesce(jsonb_agg(c order by i), '[]'::jsonb)
      from (
        select b.i, count(v.viewed_at) as c
        from b
        left join v on v.viewed_at >= b.st and v.viewed_at < b.en
        group by b.i
      ) x
    )
  );
$$;

-- One page of the per-space table, most-viewed first. 7d/30d counts are only
-- computed for the rows on the page. `total_count` repeats on every row.
create or replace function public.space_analytics_page(
  p_user_id uuid,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  title text,
  views_count integer,
  likes_count integer,
  views7d bigint,
  views30d bigint,
  total_count bigint
)
language sql
stable
set search_path = public
as $$
  with page as (
    select sp.id, sp.title, coalesce(sp.views_count, 0) as views_count,
           coalesce(sp.likes_count, 0) as likes_count,
           count(*) over () as total_count,
           row_number() over (order by sp.views_count desc nulls last, sp.created_at desc, sp.id) as rn
    from public.spaces sp
    where sp.user_id = p_user_id
    order by sp.views_count desc nulls last, sp.created_at desc, sp.id
    limit greatest(p_limit, 1) offset greatest(p_offset, 0)
  )
  select page.id, page.title, page.views_count, page.likes_count,
         count(sv.id) filter (where sv.viewed_at >= now() - interval '7 days'),
         count(sv.id),
         page.total_count
  from page
  left join public.space_views sv
    on sv.space_id = page.id
   and sv.viewed_at >= now() - interval '30 days'
  group by page.id, page.title, page.views_count, page.likes_count, page.total_count, page.rn
  order by page.rn;
$$;

revoke execute on function public.space_view_stats(uuid, timestamptz[], uuid) from public, anon, authenticated;
revoke execute on function public.space_analytics_page(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.space_view_stats(uuid, timestamptz[], uuid) to service_role;
grant execute on function public.space_analytics_page(uuid, integer, integer) to service_role;
