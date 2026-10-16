"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSpaceView } from "../data/space-view";
import type { SpaceView } from "../view-types";

const loadSpaceViewSchema = z.object({ id: z.uuid(), username: z.string().min(1) });

export type LoadSpaceViewResult = { ok: true; view: SpaceView } | { ok: false };

// Client-invoked loader for the space viewer's left/right browsing: the same
// data the viewer page renders, for a sibling space. Mirrors the page's gates —
// the space must belong to `username` and be public (or the caller's own).
export async function loadSpaceView(input: { id: string; username: string }): Promise<LoadSpaceViewResult> {
  const parsed = loadSpaceViewSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { id, username } = parsed.data;

  const admin = createAdminClient();
  const { data: space } = await admin
    .from("spaces")
    .select("*, profiles(username)")
    .eq("id", id)
    .single();
  if (!space) return { ok: false };

  const owner = space.profiles as unknown as { username: string | null } | null;
  if (owner?.username !== username) return { ok: false };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!space.is_public && user?.id !== space.user_id) return { ok: false };

  return { ok: true, view: await buildSpaceView(supabase, space, user?.id ?? null) };
}
