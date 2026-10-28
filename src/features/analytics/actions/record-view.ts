"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { recordViewSchema } from "../schemas";

export type RecordViewResult =
  | { ok: true }
  | { ok: false; error: "INVALID_INPUT" | "OWNER" | "FAILED"; message?: string };

// Records one view of a space by the current visitor. Called fire-and-forget by
// the immersive viewer's ViewTracker (folded in from `lib/actions/record-view`).
//
// Uses the admin client for the INSERT on purpose: views are recorded for ANY
// visitor — including anonymous ones — and RLS would otherwise block those
// inserts. Ownership is still enforced server-side (the owner's own views never
// count) via the authenticated session, so the admin client can't be abused to
// forge an owner view.
export async function recordSpaceView(
  spaceId: string,
  ownerId: string
): Promise<RecordViewResult> {
  const parsed = recordViewSchema.safeParse({ spaceId, ownerId });
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Never count the owner's own views.
  if (user?.id === parsed.data.ownerId) return { ok: false, error: "OWNER" };

  const admin = createAdminClient();

  // viewed_date uses UTC so it matches the unique index (one view per user per
  // space per day).
  const viewedDate = new Date().toISOString().split("T")[0];

  // The unique index is partial (viewer_id is not null), which PostgREST's
  // on_conflict can't target, so check first for logged-in viewers instead of
  // letting the insert raise unique_violation into the Postgres error logs.
  if (user) {
    const { data: existing } = await admin
      .from("space_views")
      .select("id")
      .eq("space_id", parsed.data.spaceId)
      .eq("viewer_id", user.id)
      .eq("viewed_date", viewedDate)
      .limit(1)
      .maybeSingle();
    if (existing) return { ok: true };
  }

  const { error } = await admin.from("space_views").insert({
    space_id: parsed.data.spaceId,
    viewer_id: user?.id ?? null,
    viewed_date: viewedDate,
  });

  // 23505 = unique_violation (only on a same-instant race now), anything else
  // is a real problem.
  if (error && error.code !== "23505") {
    console.error("[recordSpaceView]", error.message);
    return { ok: false, error: "FAILED", message: error.message };
  }

  return { ok: true };
}
