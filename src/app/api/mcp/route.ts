import type { NextRequest } from "next/server";
import { mcpProxyOptions, proxyToMcpFunction } from "@/lib/mcp-proxy";

// Portal proxy to the Supabase Edge MCP function. Exists because Anthropic's
// OAuth client discovers protected-resource metadata by GET-ing
// `{origin}/.well-known/oauth-protected-resource{path}` first, and Supabase's
// gateway refuses to route `/.well-known/*` to any edge function (returns
// UNAUTHORIZED_MISSING_API_KEY). Exposing the MCP endpoint on nandzz.com — an
// origin we control — lets the well-known catch-all serve the metadata and
// the client complete discovery + DCR.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = mcpProxyOptions;

const proxy = (req: NextRequest) => proxyToMcpFunction(req, "mcp");

export const GET = proxy;
export const POST = proxy;
export const HEAD = proxy;
