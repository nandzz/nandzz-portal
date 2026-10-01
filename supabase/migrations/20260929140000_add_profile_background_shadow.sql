-- ── Profile cover-image shadow toggle ───────────────────────────────────────
--
-- WHY: the public profile fades a gradient ("shadow") over the top cover image so
-- the header/avatar stay legible. Some owners prefer the raw image with no
-- overlay. This flag lets them turn that gradient off. Defaults to true so every
-- existing profile keeps its current look.
--
-- Shape: boolean, default true. Only meaningful when a cover image is set.

alter table public.profiles
  add column if not exists background_shadow boolean not null default true;

comment on column public.profiles.background_shadow is
  'Whether to fade a gradient overlay over the cover image on the public profile. Default true. Set via the profile background color picker.';
