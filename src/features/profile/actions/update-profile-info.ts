"use server";

import { createClient } from "@/lib/supabase/server";
import type { GoogleReviewListing, ProfileAddress } from "@/lib/types";
import { updateProfileInfoSchema } from "../schemas";
import { revalidatePublicProfile } from "../revalidate";

export type UpdateProfileInfoResult =
  | { ok: true }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "INVALID_INPUT" | "FAILED";
      message?: string;
    };

// Persists the EditProfileDialog fields. Scoped to the caller's own row via
// `.eq("id", user.id)`, so RLS + query agree. Revalidates the public profile
// itself, so the action's response carries the fresh render (no client
// /api/profile/revalidate + router.refresh round-trips).
export async function updateProfileInfo(input: {
  displayName: string | null;
  tagline: string | null;
  bio: string | null;
  websiteUrl: string | null;
  socialLinks: Record<string, string | undefined>;
  address: ProfileAddress | null;
  category?: string;
  googleReview?: GoogleReviewListing | null;
}): Promise<UpdateProfileInfoResult> {
  const parsed = updateProfileInfoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const { displayName, tagline, bio, websiteUrl, socialLinks, address, category, googleReview } =
    parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      tagline,
      bio,
      website_url: websiteUrl,
      social_links: socialLinks,
      address,
      ...(category ? { category } : {}),
      ...(googleReview !== undefined ? { google_review: googleReview } : {}),
    })
    .eq("id", user.id)
    .select("username")
    .single();
  if (error) return { ok: false, error: "FAILED", message: error.message };

  revalidatePublicProfile(data?.username);
  return { ok: true };
}
