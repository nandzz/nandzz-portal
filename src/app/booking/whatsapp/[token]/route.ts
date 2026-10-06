import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTranslations } from "@/lib/i18n/translations";
import { normalizeCalendarConfig } from "@/lib/widgets/calendar";
import { whatsappLink } from "@/lib/widgets/contact";

export const dynamic = "force-dynamic";

// Target of the WhatsApp reminder's "Message us" URL button
// (`https://nandzz.com/booking/whatsapp/{{n}}`, {{n}} = `business_whatsapp`).
// Resolves the booking's business WhatsApp number at click time and redirects to
// a wa.me chat with a prefilled, localized message. No number configured (or a
// bad token) ⇒ falls back to the manage-booking page, so the button never dead-ends.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const manage = new URL(`/booking/${encodeURIComponent(token)}`, req.url);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("widget_bookings")
    .select(
      "service_name, starts_at, locale, location_id, instance:widget_instances(config, owner:profiles(display_name, username))"
    )
    .eq("manage_token", token)
    .maybeSingle();
  if (error) console.error("whatsapp contact redirect: booking load failed", error);
  if (!data) return NextResponse.redirect(manage);

  const instance = (data as {
    instance?: { config?: unknown; owner?: { display_name?: string; username?: string } | null } | null;
  }).instance;
  const config = normalizeCalendarConfig(instance?.config);
  const owner = instance?.owner ?? null;
  const locale = typeof data.locale === "string" ? data.locale : "en";
  const timezone =
    config.locations.find((l) => l.id === data.location_id)?.timezone || config.timezone;

  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(data.starts_at as string));
  const message = getTranslations(locale)
    .booking.whatsappCustomerGreeting.replace("{business}", owner?.display_name || owner?.username || "")
    .replace("{service}", data.service_name as string)
    .replace("{when}", when);

  const wa = config.whatsapp_contact_phone ? whatsappLink(config.whatsapp_contact_phone, message) : null;
  return NextResponse.redirect(wa ?? manage);
}
