import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCalendarConfig } from "@/features/booking/domain/calendar";
import { buildBookingIcs } from "@/features/booking/domain/ics";

// "Add to calendar" for a booking, keyed by its unguessable manage_token (same
// authorization model as the manage page). Served as a real https URL rather
// than a client Blob so iOS Safari and the Instagram/WhatsApp in-app browsers
// open the native "Add to Calendar" sheet. Carries 2 h + 1 h alerts.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("widget_bookings")
    .select(
      "id, service_name, starts_at, ends_at, status, location_id, manage_token, instance:widget_instances(config, owner:profiles(display_name, username))"
    )
    .eq("manage_token", token)
    .maybeSingle();
  if (error) {
    console.error("[bookings/ics] load failed", error);
    return NextResponse.json({ error: "Unable to load booking." }, { status: 500 });
  }
  if (!data || data.status === "cancelled") {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const instance = data.instance as unknown as {
    config?: unknown;
    owner?: { display_name?: string | null; username?: string | null } | null;
  } | null;
  const businessName = instance?.owner?.display_name || instance?.owner?.username || "";
  const config = normalizeCalendarConfig(instance?.config);
  const location = data.location_id
    ? config.locations.find((l) => l.id === data.location_id)
    : undefined;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const manageUrl = `${siteUrl}/booking/${data.manage_token}`;

  const ics = buildBookingIcs({
    uid: `${data.id}@nandzz.com`,
    startIso: data.starts_at,
    endIso: data.ends_at,
    title: businessName ? `${data.service_name} · ${businessName}` : data.service_name,
    location: location?.address?.trim() || location?.name || undefined,
    description: manageUrl,
    url: manageUrl,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="booking.ics"',
      "Cache-Control": "no-store",
    },
  });
}
