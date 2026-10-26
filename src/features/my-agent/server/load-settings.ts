import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { settingsFromRow, type AgentSettingsRow } from "../settings";
import type { AgentSettings, KnowledgeEntry } from "../types";

// My Agent → Settings + Knowledge, real data. Read with the owner's own client
// (RLS: owner-only). No settings row yet ⇒ the table defaults.

export async function loadMyAgentSettings(supabase: SupabaseClient, userId: string): Promise<AgentSettings> {
  const { data } = await supabase
    .from("agent_settings")
    .select("enabled, agent_name, agent_intro, autonomy, agent_hours, takeover_pause_min, retention_months")
    .eq("owner_user_id", userId)
    .maybeSingle();
  return settingsFromRow((data as AgentSettingsRow | null) ?? null);
}

export async function loadMyAgentKnowledge(supabase: SupabaseClient, userId: string): Promise<KnowledgeEntry[]> {
  const { data } = await supabase
    .from("agent_knowledge")
    .select("id, title, body, updated_at")
    .eq("owner_user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((r) => ({ id: r.id, title: r.title, body: r.body, updatedAt: r.updated_at }));
}
