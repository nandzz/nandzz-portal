"use server";

import { createClient } from "@/lib/supabase/server";
import { followListSchema } from "../schemas";
import { getFollowList, type FollowUser } from "../data/profiles";

const PAGE_SIZE = 20;

export type LoadFollowListResult =
  | { ok: true; users: FollowUser[]; hasMore: boolean; nextOffset: number }
  | { ok: false; error: "INVALID_INPUT" };

// Client-invoked, offset-paginated loader for the followers/following list
// (shared by the profile dialog and the /dashboard/followers|following pages).
export async function loadFollowList(input: {
  profileId: string;
  type: "followers" | "following";
  offset: number;
}): Promise<LoadFollowListResult> {
  const parsed = followListSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const { profileId, type, offset } = parsed.data;

  const supabase = await createClient();
  const { users, rowCount } = await getFollowList(
    supabase,
    profileId,
    type,
    offset,
    offset + PAGE_SIZE - 1
  );

  return {
    ok: true,
    users,
    hasMore: rowCount === PAGE_SIZE,
    nextOffset: offset + rowCount,
  };
}
