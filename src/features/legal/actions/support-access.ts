"use server";

import { createClient } from "@/lib/supabase/server";

export type SupportAccessResult =
  | { ok: true; until: string | null }
  | { ok: false; error: "UNAUTHENTICATED" | "FAILED" };

// Owner-granted support access: while `support_access_until` is in the future,
// Nandzz admins can edit this profile through the admin MCP (mcp-admin). The
// expiry is fixed server-side (7 days) by set_support_access.
export async function getSupportAccess(): Promise<SupportAccessResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase
    .from("profiles")
    .select("support_access_until")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return { ok: false, error: "FAILED" };
  const until = (data?.support_access_until as string | null) ?? null;
  return { ok: true, until: until && new Date(until) > new Date() ? until : null };
}

export async function setSupportAccess(enabled: boolean): Promise<SupportAccessResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase.rpc("set_support_access", { p_enabled: enabled });
  if (error) return { ok: false, error: "FAILED" };
  return { ok: true, until: (data as string | null) ?? null };
}
