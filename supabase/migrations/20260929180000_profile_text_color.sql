-- ── Profile style: text color ───────────────────────────────────────────────
--
-- Owners can tint the profile header texts (name, handle, tagline, bio, follower
-- counts). NULL = follow the site's default theme text colors.

alter table public.profiles
  add column if not exists text_color text;

comment on column public.profiles.text_color is
  'Optional color for the public profile header texts, as a hex string (e.g. "#111827"). NULL = default theme text. Set via the profile style picker.';
