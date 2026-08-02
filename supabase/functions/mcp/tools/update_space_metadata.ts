import type { ToolDefinition, ToolHandler } from "./types.ts";
import {
  requireOneLookup,
  resolveSpaceForMetadata,
} from "./_shared.ts";
import type { ToolResult } from "./types.ts";

export const updateSpaceMetadataDef: ToolDefinition = {
  name: "update_space_metadata",
  description:
    "Update metadata (title, description, hashtags, visibility) of an already-published space. Free (no credits). Provide space_id XOR url (any of html_url/pdf_url/image_url) plus at least one field to change. To clear description pass null; to clear hashtags pass [].",
  inputSchema: {
    type: "object",
    properties: {
      space_id: {
        type: "string",
        description: "UUID of the space to update. Provide exactly one of space_id or url.",
      },
      url: {
        type: "string",
        description: "Any current asset URL of the space (html_url, pdf_url, or image_url).",
      },
      title: {
        type: "string",
        description: "New human-readable title.",
      },
      description: {
        type: ["string", "null"],
        description: "New description. Pass null to clear it.",
      },
      hashtags: {
        type: "array",
        items: { type: "string" },
        description: "Full replacement list of hashtags. Pass [] to clear.",
      },
      visibility: {
        type: "string",
        enum: ["private", "public"],
        description: "New visibility. Ask the user before changing — do not guess.",
      },
    },
    additionalProperties: false,
  },
};

export const updateSpaceMetadata: ToolHandler = async (args, ctx) => {
  const a = args as {
    space_id?: string;
    url?: string;
    title?: string;
    description?: string | null;
    hashtags?: string[];
    visibility?: "private" | "public";
  };
  const lookup = requireOneLookup(a.space_id, a.url);

  // Explicit-key detection: `description: null` (clear) and `hashtags: []`
  // (clear) are both real updates, so we can't just check truthiness.
  const hasTitle = typeof a.title === "string";
  const hasDescription = Object.prototype.hasOwnProperty.call(a, "description");
  const hasHashtags = Array.isArray(a.hashtags);
  const hasVisibility = a.visibility === "public" || a.visibility === "private";

  if (!hasTitle && !hasDescription && !hasHashtags && !hasVisibility) {
    throw new Error("Provide at least one field to update: title, description, hashtags, or visibility.");
  }

  if (hasTitle && a.title!.trim() === "") {
    throw new Error("title cannot be empty; omit the field to leave it unchanged.");
  }

  const patch: Record<string, unknown> = {};
  const updated: string[] = [];
  if (hasTitle)       { patch.title = a.title;                        updated.push("title"); }
  if (hasDescription) { patch.description = a.description ?? null;    updated.push("description"); }
  if (hasHashtags)    { patch.hashtags = a.hashtags;                  updated.push("hashtags"); }
  if (hasVisibility)  { patch.is_public = a.visibility === "public";  updated.push("visibility"); }

  const space = await resolveSpaceForMetadata(ctx, lookup);

  const { error } = await ctx.admin
    .from("spaces")
    .update(patch)
    .eq("id", space.id)
    .eq("user_id", ctx.userId);
  if (error) throw new Error(`Failed to update space: ${error.message}`);

  const result: ToolResult = {
    content: [
      {
        type: "text",
        text: `Updated ${updated.join(", ")} on space ${space.id}.`,
      },
    ],
    structuredContent: {
      space_id: space.id,
      updated_fields: updated,
    },
  };
  return result;
};
