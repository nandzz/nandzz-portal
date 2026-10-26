import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage, Conversation, WhatsAppConnection } from "../types";

// My Agent → Assistance, real data: the latest WhatsApp chats and their recent
// messages (agent_threads + agent_messages, written by the worker through
// mcp-agent). Read with the owner's own client (RLS: owner-only).

const MAX_THREADS = 30;
const MAX_MESSAGES_PER_THREAD = 40;

type ThreadRow = {
  id: string;
  customer_wa_id: string;
  customer_name: string | null;
  state: "agent" | "handed_off";
  last_message_at: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  direction: "in" | "out" | "owner";
  kind: "text" | "voice" | "other";
  body: string;
  created_at: string;
};

const FROM = { in: "customer", out: "agent", owner: "owner" } as const;

export async function loadMyAgentConversations(
  supabase: SupabaseClient,
  userId: string,
  takeoverMinutes: number,
  now: number,
): Promise<Conversation[]> {
  const { data: threads } = await supabase
    .from("agent_threads")
    .select("id, customer_wa_id, customer_name, state, last_message_at, created_at")
    .eq("owner_user_id", userId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(MAX_THREADS);
  const rows = (threads ?? []) as ThreadRow[];
  if (rows.length === 0) return [];

  const { data: messages } = await supabase
    .from("agent_messages")
    .select("id, thread_id, direction, kind, body, created_at")
    .eq("owner_user_id", userId)
    .in("thread_id", rows.map((t) => t.id))
    .order("created_at", { ascending: false })
    .limit(MAX_THREADS * MAX_MESSAGES_PER_THREAD);

  const byThread = new Map<string, ChatMessage[]>();
  for (const m of (messages ?? []) as MessageRow[]) {
    const list = byThread.get(m.thread_id) ?? [];
    if (list.length >= MAX_MESSAGES_PER_THREAD) continue;
    list.push({ id: m.id, from: FROM[m.direction], text: m.body, at: m.created_at, voice: m.kind === "voice" });
    byThread.set(m.thread_id, list);
  }

  return rows.flatMap((t) => {
    const list = (byThread.get(t.id) ?? []).reverse();
    if (list.length === 0) return [];
    // The takeover pause lives in the worker; the owner's last message is when it started.
    const lastOwner = [...list].reverse().find((m) => m.from === "owner");
    const resumesAt = lastOwner ? new Date(lastOwner.at).getTime() + takeoverMinutes * 60_000 : 0;
    const state: Conversation["state"] =
      t.state === "handed_off" ? "handed_off" : resumesAt > now ? "taken_over" : "handling";
    return [
      {
        id: t.id,
        customer: t.customer_name || `+${t.customer_wa_id}`,
        phone: `+${t.customer_wa_id}`,
        state,
        resumesAt: state === "taken_over" ? new Date(resumesAt).toISOString() : undefined,
        updatedAt: t.last_message_at ?? list[list.length - 1].at,
        messages: list,
      },
    ];
  });
}

/** The business's active WhatsApp number, if any. */
export async function loadWhatsAppConnection(supabase: SupabaseClient, userId: string): Promise<WhatsAppConnection | null> {
  const { data } = await supabase
    .from("whatsapp_connections")
    .select("display_phone_number, created_at")
    .eq("owner_user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  // Meta's display_phone_number may or may not carry the leading "+".
  const digits = data.display_phone_number?.trim().replace(/^\+/, "");
  return { phone: digits ? `+${digits}` : null, connectedAt: data.created_at };
}
