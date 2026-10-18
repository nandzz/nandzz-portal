import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountType } from "@/lib/types";

// Server-side read of the signed-in user's account type. Used by the
// business-only dashboard pages (Widgets / Brand / Analytics) and the
// personal-only Bookings page to enforce, at request time, the same
// account-type gating the nav chrome applies — so the sections can't be
// reached by direct URL. Defaults to 'personal' (the account default) when the
// row or column is missing, so business-only pages fail closed.
export async function getAccountType(
  supabase: SupabaseClient,
  userId: string
): Promise<AccountType> {
  const { data } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", userId)
    .maybeSingle();
  return ((data?.account_type as AccountType) ?? "personal");
}
