import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { permanentRedirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

// Columns safe to render on public profile surfaces. The admin client bypasses
// RLS and the row is handed to Client Components (serialized into the HTML for
// every visitor), so NEVER `select("*")` here: billing (stripe_*, plan_*,
// credits), is_admin, is_demo, support access, locale, etc. must stay private.
export const PUBLIC_PROFILE_COLUMNS = [
  "id",
  "username",
  "account_type",
  "category",
  "display_name",
  "tagline",
  "bio",
  "avatar_url",
  "background_url",
  "background_position",
  "background_color",
  "button_color",
  "text_color",
  "booking_button_style",
  "social_links_style",
  "website_url",
  "social_links",
  "address",
  "created_at",
  "followers_count",
  "following_count",
  "agent_enabled",
  "agent_suggested_questions",
  "gallery_layout",
  "gallery_caption_style",
  "contents_layout",
  "links_layout",
  "section_order",
  "show_contents",
  "show_gallery",
  "show_links",
  "show_follow_counts",
].join(",");

export async function fetchPublicProfile(username: string): Promise<Profile | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return (data as unknown as Profile) ?? null;
}

// Per-username tag so a single profile can be invalidated with
// revalidateTag/updateTag(`profile:${username}`). react.cache dedupes the read
// between generateMetadata, generateViewport and the page render.
export const getPublicProfile = cache((username: string) =>
  unstable_cache(
    () => fetchPublicProfile(username),
    ["public-profile", username.toLowerCase()],
    { revalidate: 60, tags: [`profile:${username.toLowerCase()}`] }
  )()
);

// Usernames are stored lowercase; send `/MarioSalon/...` to `/mariosalon/...`
// instead of 404ing links shared with capitals (e.g. an Instagram bio).
export function redirectToCanonicalUsername(username: string, rest = "") {
  const lower = username.toLowerCase();
  if (lower !== username) permanentRedirect(`/${encodeURIComponent(lower)}${rest}`);
}
