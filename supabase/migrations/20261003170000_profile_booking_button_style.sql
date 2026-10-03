-- ── Profile style: booking button style ─────────────────────────────────────
--
-- Owners can restyle the booking CTA pill on their public profile. Stored as a
-- small JSON object: { variant, shape, size, color }.
--   variant: "soft" | "solid" | "outline" | "glass"
--   shape:   "pill" | "rounded" | "square"
--   size:    "md" | "lg"
--   color:   hex string or null (null = default emerald)
-- NULL = the default soft emerald pill.

alter table public.profiles
  add column if not exists booking_button_style jsonb;

comment on column public.profiles.booking_button_style is
  'Optional style for the public profile booking CTA: {variant, shape, size, color}. NULL = default soft emerald pill. Set via the profile style picker.';
