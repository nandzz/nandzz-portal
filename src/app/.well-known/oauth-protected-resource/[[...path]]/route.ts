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
  // The admin MCP (/api/mcp-admin) is a separate resource with its own scope.
  const subpath = new URL(req.url).pathname.replace(/^\/\.well-known\/oauth-protected-resource/, "").replace(/\/$/, "");
  const isAdmin = subpath === "/api/mcp-admin";
  const resource = isAdmin ? `${origin}/api/mcp-admin` : `${origin}/api/mcp`;

  return withCors(NextResponse.json({
    resource,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    resource_documentation: `${origin}/mcp`,
    scopes_supported: isAdmin ? ["admin"] : ["publish", "read"],
  }));
}
