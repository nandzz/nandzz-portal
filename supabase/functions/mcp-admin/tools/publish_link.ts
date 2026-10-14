import type { ToolDefinition, ToolHandler } from "../../mcp/tools/types.ts";
import {
  buildSpaceUrl,
  getUsername,
  publishSpace,
  requireStr,
  requireVisibility,
} from "../../mcp/tools/_shared.ts";
import { demoProfileIdProp, requireTarget, textResult } from "./_demo.ts";

export const publishLinkDef: ToolDefinition = {
  name: "publish_link",
  description:
    "Add a link (website, menu, booking page, YouTube/Vimeo video, social post…) to a profile's Links section " +
    "(demo, or a real account with support access). " +
    "Video URLs are embedded automatically on the profile.",
  inputSchema: {
    type: "object",
    required: ["demo_profile_id", "title", "url", "visibility"],
    properties: {
      demo_profile_id: demoProfileIdProp,
      title: { type: "string", description: "Link label." },
      url: { type: "string", format: "uri", description: "Target URL (http/https)." },
      description: { type: "string", description: "Optional short description." },
      visibility: { type: "string", enum: ["private", "public"], description: "'public' shows it on the profile." },
    },
    additionalProperties: false,
  },
};

export const publishLink: ToolHandler = async (args, ctx) => {
  const demo = await requireTarget(ctx, args.demo_profile_id);
  const title = requireStr(args.title, "title");
  const visibility = requireVisibility(args.visibility);
  let url: string;
  try {
    const u = new URL(requireStr(args.url, "url"));
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    url = u.toString();
  } catch {
    throw new Error("url must be a valid http(s) URL.");
  }

  const demoCtx = { ...ctx, userId: demo.id };
  const { spaceId } = await publishSpace(demoCtx, {
    title,
    description: typeof args.description === "string" ? args.description : null,
    content_type: "link",
    url,
    is_public: visibility === "public",
    hashtags: [],
  });
  const spaceUrl = buildSpaceUrl(await getUsername(demoCtx), spaceId);
  return textResult(`Added link "${title}" to @${demo.username} as ${visibility}.\nSpace URL: ${spaceUrl}`, {
    space_id: spaceId,
    space_url: spaceUrl,
  });
};
