"use server";

import { createClient } from "@/lib/supabase/server";
import { acceptCurrentTerms } from "@/features/legal/actions/accept-terms";

export type ClaimDemoProfileResult =
  | { ok: true; username: string }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "INVALID_CODE" | "ALREADY_HAS_PROFILE" | "WIDGET_CONFLICT" | "FAILED";
    };

// Redeems a demo-profile activation code for the signed-in user. Everything —
// code check, cloning the demo profile onto the caller's id, re-pointing its
// content and deleting the placeholder account — happens atomically inside the
// claim_demo_profile SECURITY DEFINER RPC, keyed on auth.uid().
//
// `merge`: the caller already has a profile (e.g. they signed up through the
// normal flow before claiming) and confirmed that the demo takes it over — the
// account keeps its id, plan and own content; the demo's profile + content
// move onto it.
export async function claimDemoProfile(code: string, merge = false): Promise<ClaimDemoProfileResult> {
  if (typeof code !== "string" || code.length > 64) return { ok: false, error: "INVALID_CODE" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase.rpc("claim_demo_profile", { p_code: code, p_merge: merge === true });
  if (error) {
    if (error.message?.includes("INVALID_CODE")) return { ok: false, error: "INVALID_CODE" };
    if (error.message?.includes("ALREADY_HAS_PROFILE")) return { ok: false, error: "ALREADY_HAS_PROFILE" };
    if (error.message?.includes("WIDGET_CONFLICT")) return { ok: false, error: "WIDGET_CONFLICT" };
    console.error("[claim] claim_demo_profile failed:", error.message);
    return { ok: false, error: "FAILED" };
  }

  // The claim screen shows the click-wrap Terms notice next to its button, so
  // completing it records acceptance (same as the signup username step).
  await acceptCurrentTerms().catch(() => undefined);

  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, username: String(row?.username ?? "") };
}
