import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function appendQuery(base: string, params: Record<string, string | undefined>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, v);
  }
  return url.toString();
}

// Form target from /mcp/authorize. Accepts x-www-form-urlencoded (default
// <form> submission). On Allow: mints an auth code and redirects back to
// the client's redirect_uri with ?code=&state=. On Deny: redirects with
// ?error=access_denied.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const clientId = String(form.get("client_id") ?? "");
  const redirectUri = String(form.get("redirect_uri") ?? "");
  const codeChallenge = String(form.get("code_challenge") ?? "");
  const codeChallengeMethod = String(form.get("code_challenge_method") ?? "S256");
  const state = form.get("state") ? String(form.get("state")) : undefined;
  const scopeRaw = String(form.get("scope") ?? "publish read");
  const scopes = scopeRaw.split(/\s+/).filter(Boolean);

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // Validate redirect_uri against the client's registered list BEFORE any
  // redirect — otherwise the deny branch is an open redirect that anyone can
  // aim at a phishing site by crafting a consent URL. The allow branch is
  // separately re-checked inside mcp_issue_oauth_code, but we short-circuit
  // here to avoid ever bouncing to an untrusted URL.
  const admin = createAdminClient();
  const { data: client } = await admin
    .from("mcp_oauth_clients")
    .select("id, redirect_uris")
    .eq("id", clientId)
    .maybeSingle();
  if (!client || !(client.redirect_uris as string[]).includes(redirectUri)) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "The redirect_uri is not registered for this client." },
      { status: 400 }
    );
  }

  if (action === "deny") {
    // 303 See Other so the browser switches POST → GET when hitting the
    // client's callback URL.
    return NextResponse.redirect(
      appendQuery(redirectUri, { error: "access_denied", state }),
      303
    );
  }

  // Allow path — must be authenticated.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: code, error } = await supabase.rpc("mcp_issue_oauth_code", {
    p_client_id: clientId,
    p_redirect_uri: redirectUri,
    p_code_challenge: codeChallenge,
    p_code_challenge_method: codeChallengeMethod,
    p_scopes: scopes,
  });

  if (error) {
    return NextResponse.redirect(
      appendQuery(redirectUri, { error: "server_error", error_description: error.message, state }),
      303
    );
  }

  return NextResponse.redirect(
    appendQuery(redirectUri, { code: String(code), state }),
    303
  );
}
