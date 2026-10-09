"use server";

import { createClient } from "@/lib/supabase/server";
import { CURRENT_TERMS_VERSION } from "../company";

export type AcceptTermsResult = { ok: true } | { ok: false; error: "UNAUTHENTICATED" | "FAILED" };

// Records that the signed-in user accepted the CURRENT Terms (and acknowledged
// the Privacy Policy). The version is fixed server-side — the client can't
// claim acceptance of an arbitrary version. Called at signup completion
// (claimSignupProfile) and from the re-acceptance banner.
export async function acceptCurrentTerms(): Promise<AcceptTermsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { error } = await supabase.rpc("accept_legal_terms", { p_version: CURRENT_TERMS_VERSION });
  if (error) return { ok: false, error: "FAILED" };
  return { ok: true };
}
