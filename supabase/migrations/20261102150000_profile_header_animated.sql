-- ── Profile style: header animation ──────────────────────────────────────────
--
-- Opt-in, discreet entrance motion for the public profile header (cover settles
-- in, identity fades up). Off by default. Set via the profile style picker.

alter table public.profiles
  add column if not exists header_animated boolean not null default false;

comment on column public.profiles.header_animated is
  'Subtle entrance animation on the public profile header. Default false. Set via the profile style picker.';
