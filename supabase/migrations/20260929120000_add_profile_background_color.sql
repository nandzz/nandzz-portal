-- ── Profile background color ────────────────────────────────────────────────
--
-- WHY: profile owners want to personalize their public page beyond the cover
-- image — picking a background color (a suggested palette swatch or a custom
-- hex) that tints the whole page behind their content. Stored as a single hex
-- string; NULL means "use the default theme background" (no customization).
--
-- Shape: text, e.g. "#faf5ff". NULL = default (no custom background color).
--
-- The existing `select("*")` profile fetch picks it up with no query changes.

alter table public.profiles
  add column if not exists background_color text;

comment on column public.profiles.background_color is
  'Optional page background color for the public profile, as a hex string (e.g. "#faf5ff"). NULL = default theme background. Set via the profile background color picker.';
