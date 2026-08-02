import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { corsPreflight, withCors } from "@/lib/mcp-cors";
import { safe } from "@/lib/mcp-log";

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
  let rawLen = 0;
  try {
    const rawBody = await req.text();
    rawLen = rawBody.length;
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch (err) {
    console.warn(`[mcp-register][${rid}] JSON parse failed raw_len=${rawLen} err="${safe((err as Error).message)}"`);
    return withCors(NextResponse.json({ error: "invalid_client_metadata", error_description: "Body must be JSON" }, { status: 400 }));
  }

  // Log headers Anthropic's OAuth proxy might send so we can identify
  // the caller. Every value is safe()-sanitized to prevent log injection.
  const hdrDict = {
    origin: req.headers.get("origin"),
    ua: req.headers.get("user-agent"),
    ct: req.headers.get("content-type"),
    forwarded_for: req.headers.get("x-forwarded-for"),
  };
  console.log(
    `[mcp-register][${rid}] in headers=${safe(hdrDict, 300)} body=${safe(body, 800)}`
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

  const requestedGrants = Array.isArray(body.grant_types)
    ? ((body.grant_types as unknown[]).filter((g) => typeof g === "string") as string[])
    : [];
  const grantTypes = requestedGrants.length
    ? requestedGrants.filter((g) => SUPPORTED_GRANT_TYPES.has(g))
    : ["authorization_code"];
  if (grantTypes.length === 0) grantTypes.push("authorization_code");

  const requestedResponses = Array.isArray(body.response_types)
    ? ((body.response_types as unknown[]).filter((r) => typeof r === "string") as string[])
    : [];
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
    console.error(`[mcp-register][${rid}] insert failed err="${safe(error.message)}"`);
    return withCors(NextResponse.json({ error: "server_error", error_description: error.message }, { status: 500 }));
  }

  // client_secret_expires_at: 0 signals "no secret, and any secret that ever
  // exists would not expire" — required by some stricter DCR consumers for
  // public clients even though we don't issue a secret at all.
  const response = {
    client_id: data.id,
    client_id_issued_at: Math.floor(new Date(data.created_at).getTime() / 1000),
    client_secret_expires_at: 0,
    client_name: data.client_name,
    redirect_uris: data.redirect_uris,
    token_endpoint_auth_method: "none",
    grant_types: grantTypes,
    response_types: responseTypes,
    scope,
  };

  console.log(
    `[mcp-register][${rid}] issued client_id=${safe(data.id)} grants=${safe(grantTypes.join(","))} scope="${safe(scope)}"`
  );
  return withCors(NextResponse.json(response, { status: 201 }));
}
