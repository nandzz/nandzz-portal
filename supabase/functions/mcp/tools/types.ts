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
};
