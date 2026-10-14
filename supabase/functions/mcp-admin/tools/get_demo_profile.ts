import type { ToolDefinition, ToolHandler } from "../../mcp/tools/types.ts";
import { demoProfileIdProp, profileUrl, requireDemo, textResult } from "./_demo.ts";

export const getDemoProfileDef: ToolDefinition = {
  name: "get_demo_profile",
  description:
    "Show a demo profile's current fields (bio, address, colors, avatar, styles, …) and its content items with " +
    "their space_ids — use before update_demo_profile / delete_space to see what's there and what's missing.",
  inputSchema: {
    type: "object",
    required: ["demo_profile_id"],
    properties: { demo_profile_id: demoProfileIdProp },
    additionalProperties: false,
  },
};

const PROFILE_COLS =
  "username, display_name, tagline, bio, website_url, social_links, address, avatar_url, background_url, " +
  "background_color, button_color, text_color, booking_button_style, social_links_style, brand_colors, " +
  "brand_description, show_contents, show_gallery, show_links";

export const getDemoProfile: ToolHandler = async (args, ctx) => {
  const demo = await requireDemo(ctx, args.demo_profile_id);
  const [{ data: profile, error }, { data: spaces, error: spErr }] = await Promise.all([
    ctx.admin.from("profiles").select(PROFILE_COLS).eq("id", demo.id).single(),
    ctx.admin
      .from("spaces")
      .select("id, title, content_type, url, is_public, created_at")
      .eq("user_id", demo.id)
      .order("created_at", { ascending: false }),
  ]);
  if (error) throw new Error(`Profile lookup failed: ${error.message}`);
  if (spErr) throw new Error(`Content lookup failed: ${spErr.message}`);

  const p = profile as unknown as Record<string, unknown>;
  const missing = [
    !p.avatar_url && "profile picture (avatar_url)",
    !p.address && "address",
    !p.background_color && "page colors (background_color/button_color/text_color)",
  ].filter(Boolean);
  const items = (spaces ?? []).map((s) =>
    `- ${s.title} [${s.content_type}${s.is_public ? "" : ", private"}]${s.url ? ` ${s.url}` : ""} · space_id ${s.id}`
  );
  return textResult(
    `@${demo.username} — ${profileUrl(demo.username)}\n` +
      `${JSON.stringify(profile, null, 2)}\n\n` +
      `Content (${items.length}):\n${items.join("\n") || "(none)"}` +
      (missing.length ? `\n\nMissing: ${missing.join(", ")}.` : ""),
    { demo_profile_id: demo.id, profile, spaces: spaces ?? [], missing },
  );
};
