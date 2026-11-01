-- Public buckets serve files via public URLs, which bypass RLS, so the
-- bucket-wide SELECT policies only let anyone list every user's files.
-- Scope SELECT to the owner's folder instead: the browser client still needs
-- it for upsert, list (background cleanup) and remove (space delete).

do $$
declare
  b record;
begin
  for b in
    select * from (values
      ('avatars',             'Avatar images are publicly accessible'),
      ('space-previews',      'Space preview images are publicly accessible'),
      ('space-html',          'Space HTML files are publicly accessible'),
      ('space-pdfs',          'Space PDF files are publicly accessible'),
      ('space-assets',        'Space assets are publicly accessible'),
      ('profile-backgrounds', 'Profile backgrounds are publicly accessible'),
      ('space-images',        'Space images are publicly accessible')
    ) as t(bucket, old_policy)
  loop
    execute format('drop policy if exists %I on storage.objects', b.old_policy);
    execute format('drop policy if exists %I on storage.objects', 'Owners can read their own ' || b.bucket);
    execute format(
      'create policy %I on storage.objects for select to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = (select auth.uid())::text)',
      'Owners can read their own ' || b.bucket, b.bucket
    );
  end loop;
end $$;
