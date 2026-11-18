import { createClient } from "@/lib/supabase/client";
import { BOOKING_NOTIFICATION_TYPES, type Notification, type WidgetBooking } from "@/lib/types";

// Client-side realtime helpers for the booking feature. Realtime subscriptions
// fundamentally require the browser Supabase client, so — like the storage
// helpers — they live OUTSIDE `components/` to satisfy the `no-restricted-imports`
// guardrail. Components consume these through thin callbacks and never touch
// `@/lib/supabase/*` themselves (mirrors `features/spaces/realtime.ts`).

/**
 * Subscribes to new-booking INSERTs on `widget_bookings` for one widget
 * instance. RLS scopes delivery to the owner. The dashboard's WidgetWorkspace
 * uses this to bump a "today" badge, chime + banner on a fresh confirmed
 * booking, and refresh the server-rendered view. Returns an unsubscribe fn.
 */
export function subscribeToWidgetBookings(
  instanceId: string,
  handlers: { onInsert: (booking: WidgetBooking) => void; onUpdate?: (booking: WidgetBooking) => void }
): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`widget_bookings:${instanceId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "widget_bookings",
        filter: `instance_id=eq.${instanceId}`,
      },
      (payload) => handlers.onInsert(payload.new as WidgetBooking)
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "widget_bookings",
        filter: `instance_id=eq.${instanceId}`,
      },
      (payload) => handlers.onUpdate?.(payload.new as WidgetBooking)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * App-wide booking alerts: subscribes to the owner's booking notifications
 * (new / cancelled / rescheduled — written by DB triggers on widget_bookings)
 * so the banner can show on any page, not just the booking dashboard.
 * Returns an unsubscribe fn.
 */
export function subscribeToBookingNotifications(
  userId: string,
  handlers: { onNotification: (notification: Notification) => void }
): () => void {
  const supabase = createClient();
  const types: readonly string[] = BOOKING_NOTIFICATION_TYPES;
  const channel = supabase
    .channel(`booking-alerts:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const n = payload.new as Notification;
        if (types.includes(n.type)) handlers.onNotification(n);
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
