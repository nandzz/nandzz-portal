"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccountType } from "@/lib/account/server";
import { FEATURES } from "@/lib/flags";
import { rowFromSettings } from "../settings";
import type { AgentSettings } from "../types";

export type SaveAgentSettingsResult = { ok: true } | { ok: false; error: "UNAUTHENTICATED" | "INVALID_INPUT" | "FAILED" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The owner's own client writes agent_settings / agent_knowledge (RLS pins
// owner_user_id = auth.uid()). The worker reads them on every message, so a
// save takes effect on the next customer message.
async function businessOwner() {
  if (!FEATURES.businessAgent) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || (await getAccountType(supabase, user.id)) !== "business") return null;
  return { supabase, userId: user.id };
}

/** Settings tab save: everything except the on/off switch. */
export async function saveAgentSettings(input: AgentSettings): Promise<SaveAgentSettingsResult> {
  const row = rowFromSettings(input);
  if (!row) return { ok: false, error: "INVALID_INPUT" };
  const owner = await businessOwner();
  if (!owner) return { ok: false, error: "UNAUTHENTICATED" };

  const { error } = await owner.supabase
    .from("agent_settings")
    .upsert({ owner_user_id: owner.userId, ...row, updated_at: new Date().toISOString() }, { onConflict: "owner_user_id" });
  if (error) return { ok: false, error: "FAILED" };
  revalidatePath("/dashboard/my-agent", "layout");
  return { ok: true };
}

/** Header switch: the agent answers on WhatsApp only while enabled. */
export async function setAgentEnabled(enabled: boolean): Promise<SaveAgentSettingsResult> {
  if (typeof enabled !== "boolean") return { ok: false, error: "INVALID_INPUT" };
  const owner = await businessOwner();
  if (!owner) return { ok: false, error: "UNAUTHENTICATED" };

  const { error } = await owner.supabase
    .from("agent_settings")
    .upsert({ owner_user_id: owner.userId, enabled, updated_at: new Date().toISOString() }, { onConflict: "owner_user_id" });
  if (error) return { ok: false, error: "FAILED" };
  revalidatePath("/dashboard/my-agent", "layout");
  return { ok: true };
}

// ── Knowledge ─────────────────────────────────────────────────────────────────

const KNOWLEDGE_MAX_ENTRIES = 200;
export type SaveKnowledgeResult =
  | { ok: true; id: string }
  | { ok: false; error: "UNAUTHENTICATED" | "INVALID_INPUT" | "TOO_MANY" | "NOT_FOUND" | "FAILED" };

/** Creates an entry (no id) or edits one of the owner's entries. */
export async function saveKnowledgeEntry(input: { id?: string; title: string; body: string }): Promise<SaveKnowledgeResult> {
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const body = typeof input?.body === "string" ? input.body.trim() : "";
  if (!title || title.length > 200 || !body || body.length > 8000) return { ok: false, error: "INVALID_INPUT" };
  if (input.id !== undefined && !UUID_RE.test(input.id)) return { ok: false, error: "INVALID_INPUT" };
  const owner = await businessOwner();
  if (!owner) return { ok: false, error: "UNAUTHENTICATED" };
  const now = new Date().toISOString();

  if (input.id) {
    const { data, error } = await owner.supabase
      .from("agent_knowledge")
      .update({ title, body, updated_at: now })
      .eq("id", input.id)
      .eq("owner_user_id", owner.userId)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: "FAILED" };
    if (!data) return { ok: false, error: "NOT_FOUND" };
    revalidatePath("/dashboard/my-agent", "layout");
    return { ok: true, id: data.id };
  }

  const { count } = await owner.supabase
    .from("agent_knowledge")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", owner.userId);
  if ((count ?? 0) >= KNOWLEDGE_MAX_ENTRIES) return { ok: false, error: "TOO_MANY" };

  const { data, error } = await owner.supabase
    .from("agent_knowledge")
    .insert({ owner_user_id: owner.userId, title, body, created_at: now, updated_at: now })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "FAILED" };
  revalidatePath("/dashboard/my-agent", "layout");
  return { ok: true, id: data.id };
}

export async function deleteKnowledgeEntry(id: string): Promise<SaveAgentSettingsResult> {
  if (!UUID_RE.test(id ?? "")) return { ok: false, error: "INVALID_INPUT" };
  const owner = await businessOwner();
  if (!owner) return { ok: false, error: "UNAUTHENTICATED" };

  const { error } = await owner.supabase.from("agent_knowledge").delete().eq("id", id).eq("owner_user_id", owner.userId);
  if (error) return { ok: false, error: "FAILED" };
  revalidatePath("/dashboard/my-agent", "layout");
  return { ok: true };
}
