import type { ToolDefinition, ToolHandler } from "../../mcp/tools/types.ts";
import {
  buildProfilePatch,
  demoProfileIdProp,
  errorResult,
  profileFieldProps,
  profileUrl,
  requireDemo,
  textResult,
  uploadDemoAvatar,
  validateUsername,
} from "./_demo.ts";

export const updateDemoProfileDef: ToolDefinition = {
  name: "update_demo_profile",
  description:
    "Update profile fields of an existing demo profile (name, tagline, bio, website, social links, brand colors, avatar, username). " +
    "Only the fields you pass are changed; pass null to clear a field.",
  inputSchema: {
    type: "object",
    required: ["demo_profile_id"],
    properties: {
      demo_profile_id: demoProfileIdProp,
      username: { type: "string", description: "New handle (3–30 chars, lowercase letters/digits/'_'/'-')." },
      ...profileFieldProps,
    },
    additionalProperties: false,
  },
};

export const updateDemoProfile: ToolHandler = async (args, ctx) => {
  const demo = await requireDemo(ctx, args.demo_profile_id);
  const patch = buildProfilePatch(args);

  if (args.username !== undefined) {
    const username = validateUsername(args.username);
    if (username !== demo.username) {
      const { data: taken } = await ctx.admin.from("profiles").select("id").eq("username", username).maybeSingle();
      if (taken) return errorResult(`Username "${username}" is already taken.`);
      patch.username = username;
    }
  }
  if (typeof args.avatar_url === "string" && args.avatar_url) {
    patch.avatar_url = await uploadDemoAvatar(ctx, demo.id, { url: args.avatar_url });
  } else if (args.avatar_url === null) {
    patch.avatar_url = null;
  }

  if (Object.keys(patch).length === 0) return errorResult("Nothing to update — pass at least one field.");

  const { error } = await ctx.admin.from("profiles").update(patch).eq("id", demo.id).eq("is_demo", true);
  if (error) throw new Error(`Update failed: ${error.message}`);

  const username = (patch.username as string | undefined) ?? demo.username;
  return textResult(
    `Updated demo profile @${username} (${Object.keys(patch).join(", ")}).\nProfile URL: ${profileUrl(username)}`,
    { demo_profile_id: demo.id, username, profile_url: profileUrl(username), updated: Object.keys(patch) },
  );
};
