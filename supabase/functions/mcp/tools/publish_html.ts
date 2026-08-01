import type { ToolDefinition, ToolHandler } from "./types.ts";
import {
  attachToCollection,
  commonPublishProps,
  publishSpace,
  requireStr,
  requireVisibility,
  successResult,
  uploadToBucket,
  type CommonPublishArgs,
} from "./_shared.ts";

const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB

export const publishHtmlDef: ToolDefinition = {
  name: "publish_html",
  description:
    "Publish an HTML page to the caller's Nandzz space. Requires the user's explicit visibility choice (private or public). Costs credits (default 10).",
  inputSchema: {
    type: "object",
    required: ["title", "visibility", "html"],
    properties: {
      ...commonPublishProps,
      html: {
        type: "string",
        description: "Full HTML document, ready to serve as-is.",
      },
    },
    additionalProperties: false,
  },
};

export const publishHtml: ToolHandler = async (args, ctx) => {
  const a = args as CommonPublishArgs & { html?: string };
  const title = requireStr(a.title, "title");
  const visibility = requireVisibility(a.visibility);
  const html = requireStr(a.html, "html");

  if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) {
    throw new Error(`HTML too large (>${MAX_HTML_BYTES} bytes).`);
  }

  const asset = await uploadToBucket(ctx, "space-html", html, "index.html", "text/html; charset=utf-8");
  const { spaceId, freeCredits, paidCredits } = await publishSpace(ctx, {
    title,
    description: a.description ?? null,
    html_url: asset.publicUrl,
    is_public: visibility === "public",
    hashtags: a.hashtags ?? [],
  });

  if (a.collection_id) await attachToCollection(ctx, spaceId, a.collection_id);

  return successResult({
    spaceId,
    publicUrl: asset.publicUrl,
    visibility,
    collectionAttached: a.collection_id ?? null,
    remainingCredits: { free: freeCredits, paid: paidCredits },
    title,
  });
};
