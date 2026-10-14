import { NextRequest, NextResponse } from "next/server";

// Proxies the Portal MCP route (/api/mcp) to its Supabase Edge
// function. See src/app/api/mcp/route.ts for why the proxy exists.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version",
  "Access-Control-Expose-Headers": "www-authenticate",
};

export async function mcpProxyOptions() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function upstreamUrl(fn: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL not set");
  return `${base}/functions/v1/${fn}`;
}

export async function proxyToMcpFunction(req: NextRequest, fn: string): Promise<NextResponse> {
  const headers = new Headers();
  const authz = req.headers.get("authorization");
  if (authz) headers.set("authorization", authz);
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const mv = req.headers.get("mcp-protocol-version");
  if (mv) headers.set("mcp-protocol-version", mv);

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();

  const upstream = await fetch(upstreamUrl(fn), {
    method: req.method,
    headers,
    body,
    cache: "no-store",
  });

  const out = new Headers(CORS);
  const upstreamCt = upstream.headers.get("content-type");
  if (upstreamCt) out.set("content-type", upstreamCt);
  const www = upstream.headers.get("www-authenticate");
  if (www) out.set("www-authenticate", www);

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, { status: upstream.status, headers: out });
}
