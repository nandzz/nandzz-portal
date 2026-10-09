"use server";

import { createClient } from "@/lib/supabase/server";
import { claimSignupProfileSchema } from "../schemas";
import { acceptCurrentTerms } from "@/features/legal/actions/accept-terms";

export type ClaimSignupProfileResult =
  | { ok: true }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "INVALID_USERNAME" | "USERNAME_TAKEN" | "FAILED";
      message?: string;
    };

// Claims the username/profile row for a freshly-signed-in user (the
// setup-username step, primarily OAuth signups). `claim_signup_profile` is a
// SECURITY DEFINER RPC that inserts the profile AND writes the welcome-credit
// grant in one call, so OAuth signups get the same signup_credit_grant that
// email/password signups get via the handle_new_user trigger.
//
// This is a pure data write, not a session mutation — it reads the already-set
// cookie session via getUser (defense-in-depth on top of the RPC's own auth.uid
// use) and runs the RPC under the SSR server client so RLS stays the real guard.
// It sets no auth cookies, so behavior is preserved exactly.
export async function claimSignupProfile(input: {
  username: string;
  displayName: string | null;
}): Promise<ClaimSignupProfileResult> {
  const parsed = claimSignupProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_USERNAME" };
  const { username, displayName } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { error } = await supabase.rpc("claim_signup_profile", {
    p_username: username,
    p_display_name: displayName,
  });

  if (error) {
    if (error.message?.includes("USERNAME_TAKEN")) {
      return { ok: false, error: "USERNAME_TAKEN" };
    }
    if (error.message?.includes("INVALID_USERNAME")) {
      return { ok: false, error: "INVALID_USERNAME" };
    }
    return { ok: false, error: "FAILED", message: error.message };
  }

  // The signup step shows the click-wrap Terms/Privacy notice next to its
  // button, so completing it records acceptance of the current version. A
  // failure here never blocks signup — the re-acceptance banner catches it.
  await acceptCurrentTerms().catch(() => undefined);

  return { ok: true };
}
