import type { ToolDefinition, ToolHandler } from "../../mcp/tools/types.ts";
import { demoOnlyIdProp, errorResult, requireDemo, textResult } from "./_demo.ts";

export const deleteDemoProfileDef: ToolDefinition = {
  name: "delete_demo_profile",
  description:
    "Permanently delete an unclaimed demo profile and all its content. Only works on demo profiles. " +
    "Requires confirm_username to match the profile's username.",
  inputSchema: {
    type: "object",
    required: ["demo_profile_id", "confirm_username"],
    properties: {
      demo_profile_id: demoOnlyIdProp,
      confirm_username: { type: "string", description: "The demo's username, to confirm the deletion." },
    },
    additionalProperties: false,
  },
};

export const deleteDemoProfile: ToolHandler = async (args, ctx) => {
  const demo = await requireDemo(ctx, args.demo_profile_id);
  if (args.confirm_username !== demo.username) {
    return errorResult(`confirm_username must be "${demo.username}".`);
  }
  // Deleting the placeholder auth user cascades the profile and its content.
  const { error } = await ctx.admin.auth.admin.deleteUser(demo.id);
  if (error) throw new Error(`Delete failed: ${error.message}`);
  return textResult(`Deleted demo profile @${demo.username}.`, { demo_profile_id: demo.id, deleted: true });
};
