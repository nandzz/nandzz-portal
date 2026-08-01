import type { ToolDefinition, ToolHandler } from "./types.ts";

export const listCollectionsDef: ToolDefinition = {
  name: "list_collections",
  description:
    "List the caller's collections in their Nandzz space. Call this before publish_* if the user might want to file the new publication into a collection.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

export const listCollections: ToolHandler = async (_args, { admin, userId }) => {
  const { data, error } = await admin
    .from("collections")
    .select("id, name, description, is_public, is_default, created_at")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return {
      content: [{ type: "text", text: `Failed to fetch collections: ${error.message}` }],
      isError: true,
    };
  }

  const collections = data ?? [];
  return {
    content: [
      {
        type: "text",
        text:
          collections.length === 0
            ? "The user has no collections yet. Suggest creating one via the Nandzz app if they want to organize this publication."
            : `Found ${collections.length} collection(s).`,
      },
    ],
    structuredContent: { collections },
  };
};
