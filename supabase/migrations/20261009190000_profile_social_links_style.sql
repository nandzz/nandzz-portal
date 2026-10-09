-- ── Profile style: social links style ───────────────────────────────────────
--
-- Owners can restyle the social link buttons on their public profile. Stored as
-- a small JSON object: { layout, shape, size, tone }.
--   layout: "icons" | "chips" | "stack" | "minimal"
--   shape:  "pill" | "rounded" | "square"
--   size:   "md" | "lg"
--   tone:   "default" | "brand" | "filled"
-- NULL = the default small rounded icon tiles. The surface color still comes
-- from profiles.button_color.

alter table public.profiles
  add column if not exists social_links_style jsonb;

comment on column public.profiles.social_links_style is
  'Optional style for the public profile social links: {layout, shape, size, tone}. NULL = default icon tiles. Set via the profile style picker.';
