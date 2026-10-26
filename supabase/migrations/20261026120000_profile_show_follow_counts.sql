-- Whether the public profile shows the followers / following counts.
-- Hidden by default (including for existing profiles); the owner can turn
-- them on from Settings → Preferences. Only affects what visitors see — the
-- owner always sees their own counts.
alter table public.profiles
  add column if not exists show_follow_counts boolean not null default false;
