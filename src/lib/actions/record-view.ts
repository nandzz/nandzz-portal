"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function recordSpaceView(spaceId: string, ownerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Never count the owner's own views
  if (user?.id === ownerId) return;

  const admin = createAdminClient();

  // viewed_date uses UTC so it matches the unique index (one view per user per space per day).
  const viewedDate = new Date().toISOString().split("T")[0];

  // For logged-in users the unique index handles deduplication — just insert and ignore conflicts.
  const { error } = await admin.from("space_views").insert({
    space_id: spaceId,
    viewer_id: user?.id ?? null,
    viewed_date: viewedDate,
  });

  if (error && error.code !== "23505") {
    // 23505 = unique_violation (expected for dedup), anything else is a real problem
    console.error("[recordSpaceView]", error.message);
  }
}
