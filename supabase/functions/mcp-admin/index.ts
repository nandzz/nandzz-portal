import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { toolDefinitions, toolHandlers } from "./registry.ts";
import type { Ctx, ToolResult } from "../mcp/tools/types.ts";

// Admin-only MCP server (Nandzz demo accounts + support-access edits of real
// accounts). Same JSON-RPC shell as the
// public `mcp` function, but a separate endpoint hosted by the ADMIN site
// (admin.nandzz.com/api/mcp — it also serves the OAuth discovery, consent and
// token routes) and a separate token audience: only tokens minted with the `admin` scope by a Nandzz
// admin are accepted (mcp_verify_admin_token), and the public endpoint
// rejects those tokens. Every request — initialize included — is authed.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "www-authenticate",
};

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "nandzz-admin-mcp", version: "0.1.0" };

const ADMIN_ORIGIN = (Deno.env.get("ADMIN_ORIGIN") ?? "https://admin.nandzz.com").replace(/\/$/, "");
const RESOURCE_METADATA_URL = `${ADMIN_ORIGIN}/.well-known/oauth-protected-resource/api/mcp`;
const WWW_AUTHENTICATE = `Bearer resource_metadata="${RESOURCE_METADATA_URL}", scope="admin"`;

const INSTRUCTIONS =
  "Nandzz admin tools for building demo profiles for prospective client businesses, and for setting up real " +
  "business accounts whose owner granted support access. " +
  "Typical flow: create_demo_profile (fill the WHOLE profile: profile picture, address, social links, page colors " +
  "from the business's brand — not just the bio) → add content with publish_link / publish_image / publish_html / publish_pdf " +
  "(always pass demo_profile_id) → optionally configure_booking_widget (services, hours, staff, locations — demo profiles accept real bookings) → review with get_demo_profile (fix with update_demo_profile / delete_space) → create_claim_code (ask the admin first whether to grant Pro on claim, and for how many months) and hand the claim link to the business. " +
  "Rules: the address goes in the profile `address` field (not a Google Maps link); opening hours go in the booking " +
  "widget (not the bio); keep the bio to what the business does. " +
  "Real accounts: to help an existing business set up their profile, use find_profile(username) — it works only if " +
  "the owner enabled Settings → Support access (7 days); then pass its id as demo_profile_id to get_demo_profile, " +
  "update_demo_profile, publish_*, delete_space and configure_booking_widget. delete_demo_profile and create_claim_code " +
  "are demo-only. Never act on a real account without that access.";

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

function unauthorized(id: JsonRpcRequest["id"]) {
  return json(
    rpcError(id, { code: -32001, message: "Unauthorized: admin MCP token required" }),
    { status: 401, headers: { "WWW-Authenticate": WWW_AUTHENTICATE } }
  );
}

async function resolveAdmin(req: Request, admin: Ctx["admin"]): Promise<string | null> {
  const authz = req.headers.get("authorization") ?? "";
  const raw = authz.replace(/^Bearer\s+/i, "").trim();
  if (!raw) return null;
  const { data, error } = await admin.rpc("mcp_verify_admin_token", { p_raw: raw });
  if (error) {
    console.error("[mcp-admin] mcp_verify_admin_token error:", error);
    return null;
  }
  return (data as string | null) ?? null;
}

serve(async (req: Request) => {
  const rid = crypto.randomUUID().slice(0, 8);

  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

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
  const admin: Ctx["admin"] = createClient(supaUrl, supaSrk);

  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return json(rpcError(null, { code: -32700, message: "Parse error" }));
  }

  const { id, method, params } = body ?? {};
  console.log(`[mcp-admin][${rid}] method=${method} id=${id ?? "null"}`);

  // Notifications (no `id`) carry no data back — 202 per Streamable HTTP.
  // (204 makes claude.ai loop on initialize.)
  if (id === undefined) {
    return new Response(null, { status: 202, headers: CORS });
  }

  const userId = await resolveAdmin(req, admin);
  if (!userId) return unauthorized(id);

  if (method === "initialize") {
    return json(
      rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      })
    );
  }

  if (method === "ping") return json(rpcResult(id, {}));

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
    let result: ToolResult;
    try {
      result = await handler(args, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[mcp-admin][${rid}] tool ${name} threw:`, err);
      result = { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
    await audit(admin, userId, name, args, result);
    return json(rpcResult(id, result));
  }

  return json(rpcError(id, { code: -32601, message: `Method not found: ${method}` }));
});

// Record every admin tool call. Never log file payloads or codes.
async function audit(
  admin: Ctx["admin"],
  actorId: string,
  tool: string,
  args: Record<string, unknown>,
  result: ToolResult
) {
  const sc = (result.structuredContent ?? {}) as Record<string, unknown>;
  const target = (args.demo_profile_id as string | undefined) ?? (sc.demo_profile_id as string | undefined) ?? null;
  const details: Record<string, unknown> = { ok: !result.isError };
  for (const k of ["username", "title", "space_id", "url"]) {
    const v = args[k] ?? sc[k];
    if (typeof v === "string") details[k] = v.slice(0, 200);
  }
  if (result.isError) details.error = result.content[0]?.text?.slice(0, 300);
  const { error } = await admin.from("admin_audit_log").insert({
    actor_id: actorId,
    source: "mcp-admin",
    action: tool,
    target_id: target && /^[0-9a-f-]{36}$/i.test(target) ? target : null,
    details,
  });
  if (error) console.error("[mcp-admin] audit insert failed:", error);
}
