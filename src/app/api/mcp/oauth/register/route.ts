import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { corsPreflight, withCors } from "@/lib/mcp-cors";

export async function OPTIONS() {
  return corsPreflight();
}

// Dynamic Client Registration (RFC 7591). Public clients only —
// no client_secret is issued. PKCE + registered redirect_uris are the
// security boundary.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return withCors(NextResponse.json({ error: "invalid_client_metadata", error_description: "Body must be JSON" }, { status: 400 }));
  }

  const redirectUris = Array.isArray(body.redirect_uris) ? (body.redirect_uris as unknown[]).filter((u) => typeof u === "string") as string[] : [];
  if (redirectUris.length === 0) {
    return withCors(NextResponse.json({ error: "invalid_redirect_uri", error_description: "At least one redirect_uri required" }, { status: 400 }));
  }

  const clientName = typeof body.client_name === "string" ? body.client_name : null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mcp_oauth_clients")
    .insert({ client_name: clientName, redirect_uris: redirectUris })
    .select("id, client_name, redirect_uris, created_at")
    .single();

  if (error) {
    return withCors(NextResponse.json({ error: "server_error", error_description: error.message }, { status: 500 }));
  }

  return withCors(NextResponse.json(
    {
      client_id: data.id,
      client_id_issued_at: Math.floor(new Date(data.created_at).getTime() / 1000),
      client_name: data.client_name,
      redirect_uris: data.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    },
    { status: 201 }
  ));
}
