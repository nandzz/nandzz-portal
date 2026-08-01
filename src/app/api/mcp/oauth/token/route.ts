import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { corsPreflight, withCors } from "@/lib/mcp-cors";

export async function OPTIONS() {
  return corsPreflight();
}

function err(code: string, description: string, status = 400) {
  return withCors(NextResponse.json({ error: code, error_description: description }, { status }));
}

// base64url(sha256(input)) — PKCE S256 challenge format (RFC 7636).
async function sha256B64Url(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function readParams(req: NextRequest): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    const out: Record<string, string> = {};
    for (const [k, v] of form.entries()) out[k] = String(v);
    return out;
  }
  const json = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(json)) if (typeof v === "string") out[k] = v;
  return out;
}

export async function POST(req: NextRequest) {
  const p = await readParams(req);

  if (p.grant_type !== "authorization_code") {
    return err("unsupported_grant_type", "Only authorization_code is supported");
  }
  if (!p.code || !p.code_verifier || !p.redirect_uri || !p.client_id) {
    return err("invalid_request", "code, code_verifier, redirect_uri, client_id are all required");
  }

  const admin = createAdminClient();

  const { data, error } = await admin.rpc("mcp_consume_oauth_code", {
    p_code: p.code,
    p_client_id: p.client_id,
    p_redirect_uri: p.redirect_uri,
  });
  if (error) {
    // The RPC raises named exceptions we can map to standard OAuth errors.
    const msg = error.message ?? "";
    if (msg.includes("INVALID_CODE") || msg.includes("CODE_ALREADY_USED") || msg.includes("CODE_EXPIRED")) {
      return err("invalid_grant", msg);
    }
    if (msg.includes("CLIENT_MISMATCH") || msg.includes("REDIRECT_MISMATCH")) {
      return err("invalid_grant", msg);
    }
    return err("server_error", msg, 500);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return err("invalid_grant", "Code not found");

  const expected = await sha256B64Url(p.code_verifier);
  if (expected !== row.code_challenge) {
    return err("invalid_grant", "PKCE verification failed");
  }

  const { data: tokenRow, error: tokErr } = await admin.rpc("mcp_issue_token_for_user", {
    p_user_id: row.user_id,
    p_name: "OAuth grant",
    p_scopes: row.scopes,
    p_expires_at: null,
  });
  if (tokErr) return err("server_error", tokErr.message, 500);

  const t = Array.isArray(tokenRow) ? tokenRow[0] : tokenRow;
  return withCors(NextResponse.json({
    access_token: t.token,
    token_type: "Bearer",
    scope: (row.scopes as string[]).join(" "),
  }));
}
