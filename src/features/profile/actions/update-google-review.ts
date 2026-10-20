"use server";

import { createClient } from "@/lib/supabase/server";
import { googleReviewSchema } from "../schemas";
import { revalidatePublicProfile } from "../revalidate";
import type { GoogleReviewListing } from "@/lib/types";

export type UpdateGoogleReviewResult =
  | { ok: true }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "INVALID_INPUT" | "FAILED";
      message?: string;
    };

// Sets (or clears, with null) the Google listing behind the public "Leave a
// Google review" button. Scoped to the caller's own row.
export async function updateGoogleReview(
  input: GoogleReviewListing | null,
): Promise<UpdateGoogleReviewResult> {
  const parsed = googleReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase
    .from("profiles")
    .update({ google_review: parsed.data })
    .eq("id", user.id)
    .select("username")
    .single();
  if (error) return { ok: false, error: "FAILED", message: error.message };

  revalidatePublicProfile(data?.username);
  return { ok: true };
}
