-- ── Business category + mandatory address on becoming a Business ─────────────
--
-- WHY: to later list/filter businesses by kind (e.g. on a map) every business
-- needs a category and a geocoded address. The "Switch to Business" modal now
-- asks for both; lat/lng already live in profiles.address (Google Places).
--
-- category: nullable slug (personal accounts and pre-existing businesses have
-- none). The allowed list mirrors src/features/profile/domain/business-category.ts
-- — keep them in sync when adding a category.

alter table public.profiles
  add column if not exists category text
    check (category in (
      'hair_salon', 'barber', 'beauty', 'spa_massage', 'tattoo_piercing',
      'fitness', 'yoga_pilates', 'personal_trainer', 'medical', 'dental',
      'physiotherapy', 'psychology', 'nutrition', 'pet_care', 'photography',
      'education', 'music_dance', 'consulting', 'events', 'home_services',
      'automotive', 'retail', 'other'
    ));

comment on column public.profiles.category is
  'Business category slug (see business-category.ts). Required when a user switches to a Business account.';

create index if not exists idx_profiles_business_category
  on public.profiles(category)
  where account_type = 'business' and category is not null;

-- Enforce it server-side for end users: flipping personal → business requires a
-- category and an address picked from Places (with coordinates). Service role
-- and SECURITY DEFINER functions (claim_demo_profile, admin MCP) pass through,
-- and businesses that existed before this rule are untouched.
create or replace function public.profiles_require_business_details()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.account_type = 'business'
     and old.account_type is distinct from 'business'
     and (
       new.category is null
       or new.address is null
       or coalesce(jsonb_typeof(new.address -> 'lat'), '') <> 'number'
       or coalesce(jsonb_typeof(new.address -> 'lng'), '') <> 'number'
     )
  then
    raise exception 'BUSINESS_DETAILS_REQUIRED' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function public.profiles_require_business_details() from public, anon, authenticated;

drop trigger if exists profiles_require_business_details on public.profiles;
create trigger profiles_require_business_details
  before update of account_type on public.profiles
  for each row execute function public.profiles_require_business_details();
