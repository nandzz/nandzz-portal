import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { corsPreflight, withCors } from "@/lib/mcp-cors";

// Grant types this server actually implements. Anything else the client
// requests is dropped (with a warning) rather than silently returned.
const SUPPORTED_GRANT_TYPES = new Set(["authorization_code"]);
const SUPPORTED_RESPONSE_TYPES = new Set(["code"]);

export async function OPTIONS() {
  return corsPreflight();
}

// Dynamic Client Registration (RFC 7591). Public clients only —
// no client_secret is issued. PKCE + registered redirect_uris are the
// security boundary.
export async function POST(req: NextRequest) {
  const rid = crypto.randomUUID().slice(0, 8);

  let body: Record<string, unknown> = {};
  let rawBody = "";
  try {
    rawBody = await req.text();
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch (err) {
    console.warn(`[mcp-register][${rid}] JSON parse failed: raw=${rawBody.slice(0, 500)} err=${(err as Error).message}`);
    return withCors(NextResponse.json({ error: "invalid_client_metadata", error_description: "Body must be JSON" }, { status: 400 }));
  }

  console.log(
    `[mcp-register][${rid}] in origin=${req.headers.get("origin") ?? "none"} ua="${(req.headers.get("user-agent") ?? "").slice(0, 80)}" content-type=${req.headers.get("content-type") ?? "none"} body=${JSON.stringify(body).slice(0, 800)}`
  );

  const redirectUris = Array.isArray(body.redirect_uris)
    ? ((body.redirect_uris as unknown[]).filter((u) => typeof u === "string") as string[])
    : [];
  if (redirectUris.length === 0) {
    console.warn(`[mcp-register][${rid}] rejected: no redirect_uris`);
    return withCors(
      NextResponse.json({ error: "invalid_redirect_uri", error_description: "At least one redirect_uri required" }, { status: 400 })
    );
  }

  const clientName = typeof body.client_name === "string" ? body.client_name : null;

  // Echo the intersection of what the client asked for and what we support.
  // If the client sent nothing, default to authorization_code / code.
  const requestedGrants = Array.isArray(body.grant_types) ? (body.grant_types as unknown[]).filter((g) => typeof g === "string") as string[] : [];
  const grantTypes = requestedGrants.length
    ? requestedGrants.filter((g) => SUPPORTED_GRANT_TYPES.has(g))
    : ["authorization_code"];
  if (grantTypes.length === 0) grantTypes.push("authorization_code");

  const requestedResponses = Array.isArray(body.response_types) ? (body.response_types as unknown[]).filter((r) => typeof r === "string") as string[] : [];
  const responseTypes = requestedResponses.length
    ? requestedResponses.filter((r) => SUPPORTED_RESPONSE_TYPES.has(r))
    : ["code"];
  if (responseTypes.length === 0) responseTypes.push("code");

  const scope = typeof body.scope === "string" ? body.scope : "publish read";

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mcp_oauth_clients")
    .insert({ client_name: clientName, redirect_uris: redirectUris })
    .select("id, client_name, redirect_uris, created_at")
    .single();

  if (error) {
    console.error(`[mcp-register][${rid}] insert failed: ${error.message}`);
    return withCors(NextResponse.json({ error: "server_error", error_description: error.message }, { status: 500 }));
  }

  const response = {
    client_id: data.id,
    client_id_issued_at: Math.floor(new Date(data.created_at).getTime() / 1000),
    client_name: data.client_name,
    redirect_uris: data.redirect_uris,
    token_endpoint_auth_method: "none",
    grant_types: grantTypes,
    response_types: responseTypes,
    scope,
  };

  console.log(`[mcp-register][${rid}] issued client_id=${data.id} grants=${grantTypes.join(",")} scope="${scope}"`);
  return withCors(NextResponse.json(response, { status: 201 }));
}
