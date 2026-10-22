"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePublicProfile } from "../revalidate";

export type UpdateProfileLayoutResult =
  | { ok: true }
  | { ok: false; error: "UNAUTHENTICATED" | "INVALID_INPUT" | "FAILED"; message?: string };

const layout = z.enum(["carousel", "grid", "masonry", "justified", "featured", "stack", "pills"]);
const sectionId = z.enum(["gallery", "publications", "links"]);

// Only the owner-controlled presentation columns — never an arbitrary patch.
const schema = z
  .object({
    gallery_layout: layout,
    contents_layout: layout,
    links_layout: layout,
    section_order: z.array(sectionId).max(3),
  })
  .partial()
  .strict();

export type ProfileLayoutPatch = z.infer<typeof schema>;

// Section layout pickers + section reorder. Replaces the old browser-side
// write + /api/profile/revalidate + router.refresh sequence: one round-trip
// that revalidates the public profile itself (its response carries the fresh
// render), so a closed tab can't leave visitors on the stale layout.
export async function updateProfileLayout(
  input: ProfileLayoutPatch
): Promise<UpdateProfileLayoutResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id)
    .select("username")
    .single();
  if (error) return { ok: false, error: "FAILED", message: error.message };

  revalidatePublicProfile(data?.username);
  return { ok: true };
}
