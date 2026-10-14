"use server";

import { createClient } from "@/lib/supabase/server";
import { acceptCurrentTerms } from "@/features/legal/actions/accept-terms";

export type ClaimDemoProfileResult =
  | { ok: true; username: string }
  | { ok: false; error: "UNAUTHENTICATED" | "INVALID_CODE" | "ALREADY_HAS_PROFILE" | "FAILED" };

// Redeems a demo-profile activation code for the signed-in user. Everything —
// code check, cloning the demo profile onto the caller's id, re-pointing its
// content and deleting the placeholder account — happens atomically inside the
// claim_demo_profile SECURITY DEFINER RPC, keyed on auth.uid().
export async function claimDemoProfile(code: string): Promise<ClaimDemoProfileResult> {
  if (typeof code !== "string" || code.length > 64) return { ok: false, error: "INVALID_CODE" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase.rpc("claim_demo_profile", { p_code: code });
  if (error) {
    if (error.message?.includes("INVALID_CODE")) return { ok: false, error: "INVALID_CODE" };
    if (error.message?.includes("ALREADY_HAS_PROFILE")) return { ok: false, error: "ALREADY_HAS_PROFILE" };
    console.error("[claim] claim_demo_profile failed:", error.message);
    return { ok: false, error: "FAILED" };
  }

  // The claim screen shows the click-wrap Terms notice next to its button, so
  // completing it records acceptance (same as the signup username step).
  await acceptCurrentTerms().catch(() => undefined);

  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, username: String(row?.username ?? "") };
}
