import type { ToolDefinition, ToolHandler } from "../../mcp/tools/types.ts";
import { errorResult, hasSupportAccess, profileUrl, textResult } from "./_demo.ts";

export const findProfileDef: ToolDefinition = {
  name: "find_profile",
  description:
    "Look up any profile by username (handle, with or without @) to get its UUID and whether the admin tools can edit it: " +
    "demo profiles always; real accounts only while the owner has granted support access (Settings → Support access, 7 days). " +
    "Use the returned demo_profile_id with get_demo_profile, update_demo_profile, publish_*, delete_space and configure_booking_widget.",
  inputSchema: {
    type: "object",
    required: ["username"],
    properties: { username: { type: "string", description: "The profile's username, e.g. 'salonroma'." } },
    additionalProperties: false,
  },
};

export const findProfile: ToolHandler = async (args, ctx) => {
  if (typeof args.username !== "string" || !args.username.trim()) return errorResult("username is required.");
  const username = args.username.trim().replace(/^@/, "").toLowerCase();
  const { data, error } = await ctx.admin
    .from("profiles")
    .select("id, username, display_name, is_demo, support_access_until")
    .eq("username", username)
    .maybeSingle();
  if (error) throw new Error(`Profile lookup failed: ${error.message}`);
  if (!data) return errorResult(`No profile with username "${username}".`);

  const p = data as {
    id: string;
    username: string;
    display_name: string | null;
    is_demo: boolean;
    support_access_until: string | null;
  };
  const access = hasSupportAccess(p.support_access_until);
  const editable = p.is_demo || access;
  const status = p.is_demo
    ? "demo profile — editable"
    : access
      ? `real account — support access granted until ${p.support_access_until}`
      : "real account — NOT editable: ask the owner to enable Settings → Support access";
  return textResult(`@${p.username}${p.display_name ? ` (${p.display_name})` : ""}: ${status}.\nid: ${p.id}\n${profileUrl(p.username)}`, {
    demo_profile_id: p.id,
    username: p.username,
    is_demo: p.is_demo,
    editable,
    support_access_until: access ? p.support_access_until : null,
  });
};
