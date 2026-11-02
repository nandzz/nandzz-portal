import "server-only";
import { createClient } from "@/lib/supabase/server";

// The signed-in Portal user's id, or null for a guest (or on any auth error).
// The booking routes use the service-role client, so this session read is the
// only signal of WHO is acting.
export async function getSessionUserId(): Promise<string | null> {
  try {
    const ssr = await createClient();
    const {
      data: { user },
    } = await ssr.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// Is the caller the business that owns this booking widget? Owner requests skip
// the customer-facing policy (minimum notice, cancellation cutoff) and may use
// the manual-booking override.
export async function isSessionOwner(ownerUserId: string | null | undefined): Promise<boolean> {
  if (!ownerUserId) return false;
  return (await getSessionUserId()) === ownerUserId;
}
