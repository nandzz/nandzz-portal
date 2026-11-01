-- Demo pitch videos: the narrated video of a demo profile's own back-office
-- (marketing/video/demo-pitch), shown on the demo page before it's claimed.
--
-- The file lives in the public `demo-videos` bucket at `<profile_id>.mp4`,
-- uploaded by the render script with the service role. This row marks that
-- the demo has one (updated_at busts caches on re-render). It cascades away
-- with the demo profile on claim; the claim action then removes the file
-- (storage objects can only be deleted through the Storage API).
create table if not exists public.demo_videos (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default now()
);

-- Server-only: read by the portal with the service role, written by the
-- render script with the service role. No client access.
alter table public.demo_videos enable row level security;
revoke all on public.demo_videos from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('demo-videos', 'demo-videos', true, 52428800, array['video/mp4']) -- 50 MB
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
