import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Space } from "@/lib/types";

// Server-only reads for the profile feature. Consolidates the profiles /
// spaces access that used to be inlined inside the profile client components
// (settings + brand profile loads and the "see all" gallery modal).

// The logged-in user's own full profile row (settings + brand pages).
export async function getMyProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return (data as Profile) ?? null;
}

// One page of a profile's public image-type spaces, newest first, plus the exact
// total count (for the gallery modal's pagination).
export async function getPublicImageSpaces(
  supabase: SupabaseClient,
  profileId: string,
  from: number,
  to: number
): Promise<{ spaces: Space[]; count: number | null }> {
  const { data, count } = await supabase
    .from("spaces")
    .select("*", { count: "exact" })
    .eq("user_id", profileId)
    .eq("is_public", true)
    .eq("content_type", "image")
    .order("created_at", { ascending: false })
    .range(from, to);
  return { spaces: (data ?? []) as Space[], count: count ?? null };
}
