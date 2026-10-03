-- =====================================================
-- Profile views — unique visitors to a public profile page
-- =====================================================
--
-- One row per visitor per profile per UTC day. `visitor_key` is:
--   * `u:<auth uid>` for signed-in visitors (stable across days), or
--   * `a:<hash>` for anonymous visitors — sha256 of a server secret + the UTC
--     date + profile id + IP + user agent, computed by the server action.
--     The salt rotates daily and nothing raw is stored, so this is cookieless
--     (the cookie policy promises essential cookies only) and an anonymous
--     visitor can't be followed across days or profiles.
-- Written and read only through the service role (admin client), so RLS is on
-- with no policies.

create table if not exists public.profile_views (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  visitor_key text not null,
  viewer_id   uuid references public.profiles(id) on delete set null,
  viewed_at   timestamptz not null default now(),
  viewed_date date not null default current_date
);

create unique index if not exists profile_views_unique_visitor_day
  on public.profile_views (profile_id, visitor_key, viewed_date);

create index if not exists profile_views_profile_viewed_at_idx
  on public.profile_views (profile_id, viewed_at desc);

create index if not exists profile_views_viewer_id_idx
  on public.profile_views (viewer_id) where viewer_id is not null;

alter table public.profile_views enable row level security;

revoke all on public.profile_views from anon, authenticated;

-- Aggregates for the analytics dashboard. `p_bounds` are the chart bucket
-- boundaries (n buckets → n+1 timestamps). Returns one row per bucket
-- (bucket = 1..n) plus bucket 0 = the whole range, each with distinct
-- visitors and total visit-days.
create or replace function public.profile_visitor_stats(
  p_profile_id uuid,
  p_bounds timestamptz[]
)
returns table (bucket integer, visitors bigint, visits bigint)
language sql
stable
set search_path = public
as $$
  with b as (
    select i, p_bounds[i] as s, p_bounds[i + 1] as e
    from generate_series(1, array_length(p_bounds, 1) - 1) as i
  )
  select b.i, count(distinct v.visitor_key), count(v.id)
  from b
  left join public.profile_views v
    on v.profile_id = p_profile_id
   and v.viewed_at >= b.s
   and v.viewed_at < b.e
  group by b.i
  union all
  select 0, count(distinct v.visitor_key), count(v.id)
  from public.profile_views v
  where v.profile_id = p_profile_id
    and v.viewed_at >= p_bounds[1]
    and v.viewed_at < p_bounds[array_length(p_bounds, 1)]
  order by 1;
$$;

revoke execute on function public.profile_visitor_stats(uuid, timestamptz[]) from public, anon, authenticated;
grant execute on function public.profile_visitor_stats(uuid, timestamptz[]) to service_role;
