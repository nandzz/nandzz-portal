import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Ctx = {
  admin: SupabaseClient;
  userId: string;
  rid: string;
};

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export type ToolHandler = (
  args: Record<string, unknown>,
  ctx: Ctx
) => Promise<ToolResult>;

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  // MCP `_meta` is passed through in tools/list. Used here to advertise
  // OpenAI Apps SDK annotations like `openai/fileParams`, which tells the
  // ChatGPT connector runtime that named params are file inputs — the runtime
  // then auto-uploads user/AI-generated files and hands us `{download_url,
  // file_id, mime_type?, file_name?}` instead of a local path string.
  _meta?: Record<string, unknown>;
};
