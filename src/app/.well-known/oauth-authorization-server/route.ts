import { NextRequest, NextResponse } from "next/server";

// OAuth 2.0 Authorization Server metadata (RFC 8414).
// Portal is both the auth server and the login UI. The MCP resource server
// lives on Supabase Edge Functions and validates tokens issued here.
export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;

  return NextResponse.json({
    issuer: origin,
    authorization_endpoint: `${origin}/mcp/authorize`,
    token_endpoint: `${origin}/api/mcp/oauth/token`,
    registration_endpoint: `${origin}/api/mcp/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["publish", "read"],
  });
}
