import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/types";

// Client-side realtime + list-read helpers for the notification bell. Realtime subscriptions fundamentally require the browser
// Supabase client, and these mount-time list reads are paired with them (the
// component seeds its list, then merges live changes) — so, like
// the storage helpers, they live OUTSIDE `components/` to satisfy the
// `no-restricted-imports` guardrail. Components consume them through thin
// callbacks and never touch `@/lib/supabase/*` themselves. The corresponding
// MUTATIONS (mark-read) go through zod-validated Server Actions.

// ── Notifications ────────────────────────────────────────────────────────────

/** The 20 most recent notifications for a user, newest first. */
export async function fetchNotifications(
  userId: string
): Promise<Notification[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data as Notification[]) ?? [];
}

/**
 * Subscribes to new-notification INSERTs for a user. RLS scopes delivery to the
 * owner. `channelSuffix` keeps multiple mounted instances (Navbar + Sidebar)
 * from colliding on the same realtime topic. Returns an unsubscribe function.
 */
export function subscribeToNotifications(
  userId: string,
  channelSuffix: string,
  handlers: { onInsert: (notification: Notification) => void }
): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`notifications:${userId}:${channelSuffix}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => handlers.onInsert(payload.new as Notification)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ── AI-edit jobs ─────────────────────────────────────────────────────────────
