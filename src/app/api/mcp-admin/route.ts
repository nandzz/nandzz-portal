import type { NextRequest } from "next/server";
import { mcpProxyOptions, proxyToMcpFunction } from "@/lib/mcp-proxy";

// Portal proxy to the admin-only MCP edge function (mcp-admin). Separate
// endpoint + token audience from /api/mcp — only Nandzz admins can complete
// its OAuth flow, and its tokens are rejected by the public MCP (and vice versa).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = mcpProxyOptions;

const proxy = (req: NextRequest) => proxyToMcpFunction(req, "mcp-admin");

export const GET = proxy;
export const POST = proxy;
export const HEAD = proxy;
