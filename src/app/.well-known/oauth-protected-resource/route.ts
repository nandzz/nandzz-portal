import { NextRequest, NextResponse } from "next/server";

// MCP protected-resource metadata (RFC 9728). Tells clients which
// authorization server(s) can issue tokens for this MCP resource.
export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "";
  const resource = supabaseUrl ? `${supabaseUrl}/functions/v1/mcp` : "";

  return NextResponse.json({
    resource,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    resource_documentation: `${origin}/mcp`,
    scopes_supported: ["publish", "read"],
  });
}
