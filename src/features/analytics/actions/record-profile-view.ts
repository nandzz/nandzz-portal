"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { recordProfileViewSchema } from "../schemas";

export type RecordProfileViewResult =
  | { ok: true }
  | { ok: false; error: "INVALID_INPUT" | "OWNER" | "BOT" | "FAILED"; message?: string };

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse/i;

// Amplify sits behind CloudFront, which appends the true client IP as the LAST
// entry of X-Forwarded-For (earlier entries are client-controlled).
function clientIp(h: Headers): string {
  const parts = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? h.get("x-real-ip") ?? "unknown";
}

// Records one visit to a public profile page, deduped to one row per visitor
// per profile per UTC day (unique index). Called fire-and-forget by
// ProfileViewTracker.
//
// Signed-in visitors are keyed by user id. Anonymous visitors are keyed by a
// cookieless hash of a server secret + date + profile + IP + user agent — the
// salt rotates daily and nothing raw is stored (see the profile_views
// migration). Admin client for the same reason as recordSpaceView: anonymous
// inserts.
export async function recordProfileView(profileId: string): Promise<RecordProfileViewResult> {
  const parsed = recordProfileViewSchema.safeParse({ profileId });
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Never count the owner's own visits.
  if (user?.id === parsed.data.profileId) return { ok: false, error: "OWNER" };

  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return { ok: false, error: "BOT" };

  const viewedDate = new Date().toISOString().split("T")[0];
  const visitorKey = user
    ? `u:${user.id}`
    : `a:${createHash("sha256")
        .update(
          [process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", viewedDate, parsed.data.profileId, clientIp(h), ua].join("|")
        )
        .digest("hex")}`;

  const { error } = await createAdminClient().from("profile_views").insert({
    profile_id: parsed.data.profileId,
    visitor_key: visitorKey,
    viewer_id: user?.id ?? null,
    viewed_date: viewedDate,
  });

  // 23505 = unique_violation (already counted today).
  if (error && error.code !== "23505") {
    console.error("[recordProfileView]", error.message);
    return { ok: false, error: "FAILED", message: error.message };
  }

  return { ok: true };
}
