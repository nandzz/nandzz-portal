import type { ToolDefinition, ToolHandler } from "../../mcp/tools/types.ts";
import {
  buildProfilePatch,
  demoProfileIdProp,
  errorResult,
  applyProfileImages,
  profileFieldProps,
  profileFieldsMeta,
  profileUrl,
  requireDemo,
  textResult,
  validateUsername,
} from "./_demo.ts";

export const updateDemoProfileDef: ToolDefinition = {
  name: "update_demo_profile",
  description:
    "Update an existing demo profile: name, tagline, bio, address, website, social links, profile picture, cover image, " +
    "page colors (background/button/text), booking + social button styles, section visibility, username. " +
    "Only the fields you pass are changed; pass null to clear a field. Use get_demo_profile to see current values.",
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
  _meta: profileFieldsMeta,
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
  await applyProfileImages(ctx, demo.id, args, patch);

  if (Object.keys(patch).length === 0) return errorResult("Nothing to update — pass at least one field.");

  const { error } = await ctx.admin.from("profiles").update(patch).eq("id", demo.id).eq("is_demo", true);
  if (error) throw new Error(`Update failed: ${error.message}`);

  const username = (patch.username as string | undefined) ?? demo.username;
  return textResult(
    `Updated demo profile @${username} (${Object.keys(patch).join(", ")}).\nProfile URL: ${profileUrl(username)}`,
    { demo_profile_id: demo.id, username, profile_url: profileUrl(username), updated: Object.keys(patch) },
  );
};
