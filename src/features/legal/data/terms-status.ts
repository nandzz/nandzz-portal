import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CURRENT_TERMS_VERSION } from "../company";

// Whether the signed-in user has accepted the current Terms version. Reads the
// caller's own rows (RLS: select own). Fails open (treated as accepted) on a
// read error so a DB hiccup never blocks the app behind the banner.
export async function getTermsAcceptanceStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<{ needsAcceptance: boolean }> {
  const { data, error } = await supabase
    .from("legal_acceptances")
    .select("version")
    .eq("user_id", userId)
    .eq("document", "terms")
    .eq("version", CURRENT_TERMS_VERSION)
    .limit(1);

  if (error) return { needsAcceptance: false };
  return { needsAcceptance: (data ?? []).length === 0 };
}
