-- ── Profile Google review link ──────────────────────────────────────────────
--
-- WHY: businesses want a "Leave a Google review" button on their public
-- profile. Google's write-review deep link needs the place_id of the business
-- LISTING (an establishment), which `profiles.address.place_id` can't guarantee
-- (the address picker also accepts plain street addresses, which have no review
-- page). So the owner picks their listing separately, from an
-- establishment-only search on the Brand page.
--
-- Shape (JSONB, nullable — no listing is the default):
--   { "place_id": string, "name": string, "address"?: string, "enabled": boolean }
--
-- Owner-editable (not a protected column) and public: it's rendered on the
-- profile via PUBLIC_PROFILE_COLUMNS.

alter table public.profiles
  add column if not exists google_review jsonb;

comment on column public.profiles.google_review is
  'Optional Google business listing for the public "Leave a Google review" button. JSONB: { place_id, name, address?, enabled }. Set via /dashboard/brand.';
