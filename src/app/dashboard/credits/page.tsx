import { redirect } from "next/navigation";

// /dashboard/credits was renamed to /dashboard/subscription. Keep old links
// (Stripe return URLs, emails, bookmarks) working, query string included.
export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value ? [value] : []) params.append(key, v);
  }
  const qs = params.toString();
  redirect(`/dashboard/subscription${qs ? `?${qs}` : ""}`);
}
