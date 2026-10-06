import { permanentRedirect } from "next/navigation";

// Legacy URL (`/[username]/booking/[instanceId]`). Each profile has exactly one
// calendar, so the canonical booking page is `/[username]/booking`; keep old
// shared links working by redirecting there.
export default async function LegacyWidgetPage({
  params,
}: {
  params: Promise<{ username: string; instanceId: string }>;
}) {
  const { username } = await params;
  permanentRedirect(`/${encodeURIComponent(username)}/booking`);
}
