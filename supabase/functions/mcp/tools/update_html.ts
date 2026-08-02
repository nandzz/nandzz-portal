import type { ToolDefinition, ToolHandler } from "./types.ts";
import {
  buildSpaceUrl,
  getUsername,
  requireOneLookup,
  requireStr,
  resolveSpaceForAssetUpdate,
  updateSuccessResult,
  uploadToBucket,
} from "./_shared.ts";

const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB — matches publish_html

export const updateHtmlDef: ToolDefinition = {
  name: "update_html",
  description:
    "Replace the HTML asset of an already-published space. Free (no credits). Provide space_id XOR url (the current html_url). Metadata (title/visibility/hashtags) is handled by update_space_metadata.",
  inputSchema: {
    type: "object",
    required: ["html"],
    properties: {
      space_id: {
        type: "string",
        description: "UUID of the space to update. Provide exactly one of space_id or url.",
      },
      url: {
        type: "string",
        description: "Current html_url of the space to update. Provide exactly one of space_id or url.",
      },
      html: {
        type: "string",
        description: "New full HTML document, ready to serve as-is.",
      },
    },
    additionalProperties: false,
  },
};

export const updateHtml: ToolHandler = async (args, ctx) => {
  const a = args as { space_id?: string; url?: string; html?: string };
  const lookup = requireOneLookup(a.space_id, a.url);
  const html = requireStr(a.html, "html");

  if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) {
    throw new Error(`HTML too large (>${MAX_HTML_BYTES} bytes).`);
  }

  const space = await resolveSpaceForAssetUpdate(ctx, lookup, "html");
  const asset = await uploadToBucket(ctx, "space-html", html, "index.html", "text/html; charset=utf-8");

  // cleanup TODO — needs orphan sweeper; skipping deletion of the old blob so
  // cached URLs don't 404 mid-cutover.
  const { error } = await ctx.admin
    .from("spaces")
    .update({ html_url: asset.publicUrl })
    .eq("id", space.id)
    .eq("user_id", ctx.userId);
  if (error) throw new Error(`Failed to update space: ${error.message}`);

  const username = await getUsername(ctx);
  return updateSuccessResult({
    spaceId: space.id,
    spaceUrl: buildSpaceUrl(username, space.id),
    kind: "html",
  });
};
