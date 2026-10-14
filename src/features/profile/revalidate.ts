import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

// Invalidates the cached public profile (getPublicProfile's `profile:<username>`
// tag + the route) from INSIDE the mutating server action, so it can't be
// skipped by a closed tab / failed follow-up request, and so the action's own
// response carries the fresh RSC payload (no extra client fetch +
// router.refresh round-trips). `{ expire: 0 }` = read-your-own-writes: the next
// render is fresh instead of stale-while-revalidate.
export function revalidatePublicProfile(username: string | null | undefined) {
  if (!username) return;
  revalidateTag(`profile:${username}`, { expire: 0 });
  revalidatePath(`/${username}`);
}

// A row-write action must only persist URLs pointing at the caller's OWN folder
// in our public storage bucket — otherwise a direct action call could set the
// avatar/cover to any external URL (e.g. a tracking pixel logging every
// visitor's IP).
export function isOwnStorageUrl(url: string, bucket: string, userId: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  return url.startsWith(`${base}/storage/v1/object/public/${bucket}/${userId}/`);
}
