-- ── Profile style: header layout ─────────────────────────────────────────────
--
-- Owners pick how the public profile header arranges cover, avatar and info:
--   "centered" | "banner" | "card" | "hero"
-- NULL = "centered" (the original layout). Set via the profile style picker.

alter table public.profiles
  add column if not exists header_layout text;

alter table public.profiles
  drop constraint if exists profiles_header_layout_check;

alter table public.profiles
  add constraint profiles_header_layout_check
  check (header_layout is null or header_layout in ('centered', 'banner', 'card', 'hero'));

comment on column public.profiles.header_layout is
  'Public profile header layout: centered | banner | card | hero. NULL = centered. Set via the profile style picker.';
