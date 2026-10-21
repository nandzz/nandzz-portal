"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { claimSignupProfileSchema } from "../schemas";

export type UsernameAvailability = "available" | "taken" | "invalid";

// Public, unauthenticated availability check for the "claim your page" sheet a
// logged-out visitor opens from someone's profile. Usernames are already public
// (every profile lives at /<username>), so answering taken/available leaks
// nothing new. Validation reuses the claim schema (format + reserved routes);
// `claim_signup_profile` stays the final authority at signup.
export async function checkUsernameAvailability(raw: string): Promise<UsernameAvailability> {
  const username = String(raw ?? "").trim().toLowerCase();
  const parsed = claimSignupProfileSchema.shape.username.safeParse(username);
  if (!parsed.success) return "invalid";

  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  // On a lookup failure don't block the visitor — signup re-checks anyway.
  if (error) return "available";
  return data ? "taken" : "available";
}
