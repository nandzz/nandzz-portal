import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siblingGroup } from "../sibling-group";

type NeighborSource = {
  id: string;
  user_id: string;
  created_at: string;
  content_type: string | null;
};

export type SpaceNeighbors = { prevId: string | null; nextId: string | null };

// Server-only read: the previous (newer) and next (older) public space in the
// same profile section as `space`, using the profile's ordering
// (created_at desc, id desc) as a keyset. Powers left/right browsing in the
// space viewer.
export async function getSpaceNeighbors(
  supabase: SupabaseClient,
  space: NeighborSource
): Promise<SpaceNeighbors> {
  const group = siblingGroup(space.content_type);
  if (!group) return { prevId: null, nextId: null };

  const base = () => {
    const q = supabase
      .from("spaces")
      .select("id")
      .eq("user_id", space.user_id)
      .eq("is_public", true);
    return group === "gallery"
      ? q.eq("content_type", "image")
      : q.not("content_type", "in", "(image,link,video)");
  };

  const at = `"${space.created_at}"`;
  const [{ data: prev }, { data: next }] = await Promise.all([
    base()
      .or(`created_at.gt.${at},and(created_at.eq.${at},id.gt.${space.id})`)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1),
    base()
      .or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${space.id})`)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1),
  ]);

  return { prevId: prev?.[0]?.id ?? null, nextId: next?.[0]?.id ?? null };
}
