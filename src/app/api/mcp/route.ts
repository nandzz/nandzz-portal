import { NextRequest, NextResponse } from "next/server";

// Portal proxy to the Supabase Edge MCP function. Exists because Anthropic's
// OAuth client discovers protected-resource metadata by GET-ing
// `{origin}/.well-known/oauth-protected-resource{path}` first, and Supabase's
// gateway refuses to route `/.well-known/*` to any edge function (returns
// UNAUTHORIZED_MISSING_API_KEY). Exposing the MCP endpoint on nandzz.com — an
// origin we control — lets the well-known catch-all serve the metadata and
// the client complete discovery + DCR.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version",
  "Access-Control-Expose-Headers": "www-authenticate",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function upstreamUrl(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL not set");
  return `${base}/functions/v1/mcp`;
}

async function proxy(req: NextRequest): Promise<NextResponse> {
  const headers = new Headers();
  const authz = req.headers.get("authorization");
  if (authz) headers.set("authorization", authz);
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const mv = req.headers.get("mcp-protocol-version");
  if (mv) headers.set("mcp-protocol-version", mv);

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();

  const upstream = await fetch(upstreamUrl(), {
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

export const GET = proxy;
export const POST = proxy;
export const HEAD = proxy;
