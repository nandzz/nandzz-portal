-- Returns the user ID for a verified phone number, or NULL if not found.
-- Used by the WhatsApp webhook to identify callers without exposing auth.users.
create or replace function public.get_user_id_by_verified_phone(phone_number text)
returns uuid
language sql
security definer
stable
as $$
  select id
  from auth.users
  where replace(phone, '+', '') = replace(phone_number, '+', '')
    and phone_confirmed_at is not null
  limit 1;
$$;

-- Only the service role may call this function.
revoke execute on function public.get_user_id_by_verified_phone(text) from anon, authenticated;
grant  execute on function public.get_user_id_by_verified_phone(text) to service_role;
