import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationPayload, NotificationType } from "./types";

export async function createNotification(
  supabase: SupabaseClient,
  userId: string,
  type: NotificationType,
  payload: NotificationPayload
) {
  const { error } = await supabase.from("notifications").insert({ user_id: userId, type, payload });
  if (error) console.error("createNotification failed:", error.message);
}
