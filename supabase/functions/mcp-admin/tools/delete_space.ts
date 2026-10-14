import type { ToolDefinition, ToolHandler } from "../../mcp/tools/types.ts";
import { demoProfileIdProp, errorResult, requireTarget, textResult } from "./_demo.ts";

export const deleteSpaceDef: ToolDefinition = {
  name: "delete_space",
  description:
    "Delete one content item (link, image, html, pdf…) from a demo profile or a real account with support access. Get space_ids from get_demo_profile.",
  inputSchema: {
    type: "object",
    required: ["demo_profile_id", "space_id"],
    properties: {
      demo_profile_id: demoProfileIdProp,
      space_id: { type: "string", description: "UUID of the space to delete." },
    },
    additionalProperties: false,
  },
};

const BUCKETS: Array<[string, string]> = [
  ["preview_image_url", "space-previews"],
  ["html_url", "space-html"],
  ["pdf_url", "space-pdfs"],
  ["image_url", "space-images"],
];

// Same cleanup as deleteSpace in src/features/spaces/actions/delete-space.ts:
// remove uploaded blobs first so deleting never orphans storage.
export const deleteSpace: ToolHandler = async (args, ctx) => {
  const demo = await requireTarget(ctx, args.demo_profile_id);
  if (typeof args.space_id !== "string" || !/^[0-9a-f-]{36}$/i.test(args.space_id)) {
    return errorResult("space_id must be a UUID.");
  }
  const { data: space, error } = await ctx.admin
    .from("spaces")
    .select("id, title, preview_image_url, html_url, pdf_url, image_url")
    .eq("id", args.space_id)
    .eq("user_id", demo.id)
    .maybeSingle();
  if (error) throw new Error(`Space lookup failed: ${error.message}`);
  if (!space) return errorResult(`Space ${args.space_id} not found on @${demo.username}.`);

  const row = space as Record<string, string | null>;
  await Promise.all(
    BUCKETS.map(([col, bucket]) => {
      const url = row[col];
      const marker = `/object/public/${bucket}/`;
      const idx = url ? url.indexOf(marker) : -1;
      if (!url || idx === -1) return null;
      return ctx.admin.storage.from(bucket).remove([url.slice(idx + marker.length).split("?")[0]]);
    }),
  );

  const { error: delErr } = await ctx.admin.from("spaces").delete().eq("id", row.id).eq("user_id", demo.id);
  if (delErr) throw new Error(`Delete failed: ${delErr.message}`);
  return textResult(`Deleted "${row.title}" from @${demo.username}.`, { space_id: row.id, deleted: true });
};
