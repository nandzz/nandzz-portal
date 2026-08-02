import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/mcp-cors";

export async function OPTIONS() {
  return corsPreflight();
}

// MCP protected-resource metadata (RFC 9728). Tells clients which
// authorization server(s) can issue tokens for this MCP resource.
// Catch-all path: RFC 9728 clients construct the metadata URL by inserting
// `/.well-known/oauth-protected-resource` between origin and resource path,
// so both `/.well-known/oauth-protected-resource` and
// `/.well-known/oauth-protected-resource/api/mcp` must return the same doc.
export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
  const resource = `${origin}/api/mcp`;

  return withCors(NextResponse.json({
    resource,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    resource_documentation: `${origin}/mcp`,
    scopes_supported: ["publish", "read"],
  }));
}
