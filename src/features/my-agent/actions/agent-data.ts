"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccountType } from "@/lib/account/server";
import { FEATURES } from "@/lib/flags";
import { notifyChatsForgotten, type ChatRef } from "../server/notify-worker";

// The owner deletes what the agent recorded, or disconnects the number. All
// writes go through the owner's own client (RLS: owner-only deletes; the
// connection can only be flipped to 'disconnected').

export type AgentDataResult = { ok: true } | { ok: false; error: "UNAUTHENTICATED" | "INVALID_INPUT" | "NOT_FOUND" | "FAILED" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ThreadChat = { customer_wa_id: string; connection: { phone_number_id: string } | null };

async function businessOwner() {
  if (!FEATURES.businessAgent) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || (await getAccountType(supabase, user.id)) !== "business") return null;
  return { supabase, userId: user.id };
}

const chatRefs = (rows: ThreadChat[]): ChatRef[] =>
  rows.flatMap((t) => (t.connection ? [{ phoneNumberId: t.connection.phone_number_id, customerWaId: t.customer_wa_id }] : []));

/** Removes one entry from the Activity feed. Pending approvals are decided, not deleted. */
export async function deleteActivityItem(id: string): Promise<AgentDataResult> {
  if (!UUID_RE.test(id ?? "")) return { ok: false, error: "INVALID_INPUT" };
  const owner = await businessOwner();
  if (!owner) return { ok: false, error: "UNAUTHENTICATED" };

  const { data, error } = await owner.supabase
    .from("agent_activity")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", owner.userId)
    .select("id");
  if (error) return { ok: false, error: "FAILED" };
  if (!data?.length) return { ok: false, error: "NOT_FOUND" };
  revalidatePath("/dashboard/my-agent", "layout");
  return { ok: true };
}

/**
 * Deletes a conversation: its messages, activity and open requests go with it
 * (FK cascade), and the worker forgets the chat. Bookings stay; they belong to
 * the calendar.
 */
export async function deleteConversation(id: string): Promise<AgentDataResult> {
  if (!UUID_RE.test(id ?? "")) return { ok: false, error: "INVALID_INPUT" };
  const owner = await businessOwner();
  if (!owner) return { ok: false, error: "UNAUTHENTICATED" };

  const { data, error } = await owner.supabase
    .from("agent_threads")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", owner.userId)
    .select("customer_wa_id, connection:whatsapp_connections(phone_number_id)");
  if (error) return { ok: false, error: "FAILED" };
  if (!data?.length) return { ok: false, error: "NOT_FOUND" };
  await notifyChatsForgotten(chatRefs(data as unknown as ThreadChat[]));
  revalidatePath("/dashboard/my-agent", "layout");
  return { ok: true };
}

/**
 * Disconnects the WhatsApp number: the agent stops answering at once (the
 * worker only serves active connections) and forgets every chat it was in.
 * With deleteHistory, all conversations and activity are deleted too.
 */
export async function disconnectWhatsApp(input: { deleteHistory: boolean }): Promise<AgentDataResult> {
  if (typeof input?.deleteHistory !== "boolean") return { ok: false, error: "INVALID_INPUT" };
  const owner = await businessOwner();
  if (!owner) return { ok: false, error: "UNAUTHENTICATED" };

  const { data: disconnected, error } = await owner.supabase
    .from("whatsapp_connections")
    .update({ status: "disconnected", updated_at: new Date().toISOString() })
    .eq("owner_user_id", owner.userId)
    .eq("status", "active")
    .select("id");
  if (error) return { ok: false, error: "FAILED" };
  if (!disconnected?.length) return { ok: false, error: "NOT_FOUND" };

  // TODO(embedded-signup): also unsubscribe our app from the WABA and drop the
  // Meta access token from Vault once Embedded Signup stores one.

  const { data: threads } = await owner.supabase
    .from("agent_threads")
    .select("customer_wa_id, connection:whatsapp_connections(phone_number_id)")
    .eq("owner_user_id", owner.userId)
    .in("connection_id", disconnected.map((c) => c.id));

  if (input.deleteHistory) {
    const [threadsDeleted, activityDeleted] = await Promise.all([
      owner.supabase.from("agent_threads").delete().eq("owner_user_id", owner.userId),
      owner.supabase.from("agent_activity").delete().eq("owner_user_id", owner.userId),
    ]);
    if (threadsDeleted.error || activityDeleted.error) return { ok: false, error: "FAILED" };
  }
  await notifyChatsForgotten(chatRefs((threads ?? []) as unknown as ThreadChat[]));
  revalidatePath("/dashboard/my-agent", "layout");
  return { ok: true };
}
