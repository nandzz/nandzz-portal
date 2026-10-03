// A space's `html_url` is fetched server-side and served on our origin, so it
// must point at the owner's folder in our own public `space-html` bucket —
// never an arbitrary (or internal) host.
export function isOwnSpaceHtmlUrl(url: string | null | undefined, ownerId: string): boolean {
  if (!url) return false;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const expected = new URL(base);
  return (
    parsed.origin === expected.origin &&
    parsed.pathname.startsWith(`/storage/v1/object/public/space-html/${ownerId}/`) &&
    !parsed.pathname.includes("..")
  );
}
