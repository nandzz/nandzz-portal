import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { toolDefinitions, toolHandlers } from "./tools/registry.ts";
import type { Ctx, ToolResult } from "./tools/types.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "www-authenticate",
};

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "nandzz-mcp", version: "0.1.0" };

// Portal origin that hosts the OAuth authorization server + metadata.
// Only prod Portal exists (nandzz.com); both dev + prod edge functions
// point at it. Override with the PORTAL_ORIGIN secret if that ever changes.
const PORTAL_ORIGIN = Deno.env.get("PORTAL_ORIGIN") ?? "https://nandzz.com";
const RESOURCE_METADATA_URL = `${PORTAL_ORIGIN}/.well-known/oauth-protected-resource`;

// RFC 9728 / MCP 2025-06-18: on 401 the resource server tells the client
// where to find its metadata. Without this header, MCP clients can't
// discover the authorization server and OAuth registration silently fails.
const WWW_AUTHENTICATE = `Bearer resource_metadata="${RESOURCE_METADATA_URL}"`;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcError = { code: number; message: string; data?: unknown };

function rpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0" as const, id: id ?? null, result };
}

function rpcError(id: JsonRpcRequest["id"], error: JsonRpcError) {
  return { jsonrpc: "2.0" as const, id: id ?? null, error };
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...CORS, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

// verify_jwt=false on this function: MCP clients (Claude Desktop) send their
// own bearer token, not a Supabase JWT. We validate against mcp_tokens ourselves.
async function resolveCaller(req: Request, admin: ReturnType<typeof createClient>): Promise<string | null> {
  const authz = req.headers.get("authorization") ?? "";
  const raw = authz.replace(/^Bearer\s+/i, "").trim();
  if (!raw) return null;
  const { data, error } = await admin.rpc("mcp_verify_token", { p_raw: raw });
  if (error) {
    console.error("[mcp] mcp_verify_token error:", error);
    return null;
  }
  return (data as string | null) ?? null;
}

serve(async (req: Request) => {
  const rid = crypto.randomUUID().slice(0, 8);

  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // GET/HEAD probes get a 401 with the WWW-Authenticate challenge so MCP
  // clients that discover via any method can find the authorization server.
  if (req.method === "GET" || req.method === "HEAD") {
    return json(
      { error: "Unauthorized", resource_metadata: RESOURCE_METADATA_URL },
      { status: 401, headers: { "WWW-Authenticate": WWW_AUTHENTICATE } }
    );
  }

  if (req.method !== "POST") {
    return json({ error: "Use POST for MCP JSON-RPC" }, { status: 405 });
  }

  const supaUrl = Deno.env.get("SUPABASE_URL");
  const supaSrk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supaUrl || !supaSrk) {
    return json({ error: "Server misconfigured" }, { status: 500 });
  }
  const admin = createClient(supaUrl, supaSrk);

  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return json(rpcError(null, { code: -32700, message: "Parse error" }));
  }

  const { id, method, params } = body ?? {};
  console.log(`[mcp][${rid}] method=${method} id=${id ?? "null"}`);

  // `initialize` is unauthenticated — it's the capability handshake.
  if (method === "initialize") {
    return json(
      rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      })
    );
  }

  // JSON-RPC notifications (no `id` member) — MCP Streamable HTTP requires
  // 202 Accepted with no body. Returning 204 makes claude.ai's connector
  // treat the handshake as incomplete and loop on `initialize`.
  if (id === undefined) {
    return new Response(null, { status: 202, headers: CORS });
  }

  // All other methods require a valid token.
  const userId = await resolveCaller(req, admin);
  if (!userId) {
    return json(
      rpcError(id, { code: -32001, message: "Unauthorized: invalid or missing MCP token" }),
      { status: 401, headers: { "WWW-Authenticate": WWW_AUTHENTICATE } }
    );
  }

  if (method === "tools/list") {
    return json(rpcResult(id, { tools: toolDefinitions }));
  }

  if (method === "tools/call") {
    const name = (params?.name as string) ?? "";
    const args = (params?.arguments as Record<string, unknown>) ?? {};
    const handler = toolHandlers[name];
    if (!handler) {
      return json(rpcError(id, { code: -32602, message: `Unknown tool: ${name}` }));
    }
    const ctx: Ctx = { admin, userId, rid };
    try {
      const result: ToolResult = await handler(args, ctx);
      return json(rpcResult(id, result));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[mcp][${rid}] tool ${name} threw:`, err);
      return json(
        rpcResult(id, {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        })
      );
    }
  }

  return json(rpcError(id, { code: -32601, message: `Method not found: ${method}` }));
});
