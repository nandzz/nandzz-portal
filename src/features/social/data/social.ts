import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Server-only read helpers for likes. These consolidate the table
// access that used to be inlined across the profile/space pages, so UI
// and route code never issues raw `.from("space_likes")` queries.

// Whether `userId` likes a single space.
export async function getSpaceLiked(
  supabase: SupabaseClient,
  spaceId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("space_likes")
    .select("id")
    .eq("user_id", userId)
    .eq("space_id", spaceId)
    .maybeSingle();
  return !!data;
}

// Subset of `spaceIds` that `userId` likes — batched lookup for lists/grids.
export async function getLikedSpaceIds(
  supabase: SupabaseClient,
  userId: string,
  spaceIds: string[]
): Promise<string[]> {
  if (spaceIds.length === 0) return [];
  const { data } = await supabase
    .from("space_likes")
    .select("space_id")
    .eq("user_id", userId)
    .in("space_id", spaceIds);
  return data?.map((l) => l.space_id as string) ?? [];
}

// Authoritative like count for a space (counts rows rather than trusting the
// denormalized `spaces.likes_count`, so the value is correct post-mutation).
export async function getSpaceLikesCount(
  supabase: SupabaseClient,
  spaceId: string
): Promise<number> {
  const { count } = await supabase
    .from("space_likes")
    .select("id", { count: "exact", head: true })
    .eq("space_id", spaceId);
  return count ?? 0;
}
