-- Allow 2-character usernames (was 3–30, now 2–30).
--
-- Patches the length check in the two functions that validate usernames,
-- starting from each function's LIVE definition (pg_get_functiondef) rather
-- than re-pasting a migration copy, so any drift between migrations and the
-- deployed body is preserved. CREATE OR REPLACE keeps existing grants.

do $$
declare
  r      record;
  v_def  text;
  v_new  text;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('claim_signup_profile', 'change_username')
  loop
    v_def := pg_get_functiondef(r.oid);
    v_new := regexp_replace(
      v_def,
      'length\((p_username|v_new)\) < 3',
      'length(\1) < 2',
      'g'
    );
    if v_new = v_def then
      raise exception 'username_min_two_chars: no "< 3" length check found in %', r.proname;
    end if;
    execute v_new;
  end loop;
end;
$$;
