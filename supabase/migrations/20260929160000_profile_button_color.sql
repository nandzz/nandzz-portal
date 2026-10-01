-- ── Profile style: drop shadow flag, add button color ───────────────────────
--
-- The cover-image shadow toggle was dropped (the gradient overlay is always on
-- now). In its place, owners can tint the neutral button/pill surfaces on their
-- public profile with a chosen color. NULL = follow the site's default theme.

alter table public.profiles
  drop column if exists background_shadow;

alter table public.profiles
  add column if not exists button_color text;

comment on column public.profiles.button_color is
  'Optional background color for the neutral button/pill surfaces on the public profile, as a hex string (e.g. "#7c3aed"). NULL = default theme surface. Set via the profile style picker.';
