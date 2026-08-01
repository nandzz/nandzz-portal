import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// List the caller's MCP tokens (metadata only — the plaintext token is
// returned exactly once, at issue time).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("mcp_tokens")
    .select("id, name, token_prefix, scopes, created_at, last_used_at, expires_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tokens: data ?? [] });
}

// Issue a new token. Body: { name?, expires_at? (ISO string) }.
// Response includes the plaintext token — the caller MUST save it now;
// it can never be retrieved again.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : null;
  const expiresAt = typeof body.expires_at === "string" ? body.expires_at : null;

  const { data, error } = await supabase.rpc("mcp_issue_token", {
    p_name: name,
    p_expires_at: expiresAt,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    id: row.id,
    prefix: row.prefix,
    token: row.token,
    warning: "Save this token now — it will never be shown again.",
  });
}
