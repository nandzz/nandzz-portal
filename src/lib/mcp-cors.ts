// CORS helpers for MCP OAuth endpoints (both /api/mcp/oauth/* and the two
// /.well-known/oauth-* routes). Claude Desktop and other MCP clients drive
// the OAuth flow from a browser context (system browser or embedded webview),
// so cross-origin fetches to these routes must return Access-Control-*.
import { NextResponse } from "next/server";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Max-Age": "86400",
};

export function corsPreflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export function withCors<T extends NextResponse>(res: T): T {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}
