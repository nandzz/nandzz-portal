import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Whether the platform-wide WhatsApp reminder is switched on (nandzz-admin →
// WhatsApp; app_settings `booking_whatsapp_template`.enabled). The booking
// funnel only offers the opt-in checkbox when this AND the business's own
// `whatsapp_reminder` toggle are on. Sending lives in the booking-notifications
// edge function; this is just the read for the UI gate.
export async function isWhatsAppReminderLive(): Promise<boolean> {
  try {
    const { data } = await createAdminClient()
      .from("app_settings")
      .select("value")
      .eq("key", "booking_whatsapp_template")
      .maybeSingle();
    return (data as { value?: { enabled?: unknown } } | null)?.value?.enabled === true;
  } catch {
    return false;
  }
}
