import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeAvailableSlots,
  normalizeCalendarConfig,
  todayInZone,
} from "@/lib/widgets/calendar";

// Public: open slots for a service on a calendar widget over a date window.
// No auth — visitors (and the AI chat) need to see availability. Reads with the
// service-role client; entitlement is enforced here so an unpaid widget shows
// nothing bookable.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const { instanceId } = await params;
  const url = new URL(req.url);
  const serviceId = url.searchParams.get("service_id");
  const staffId = url.searchParams.get("staff_id");
  const days = Math.min(60, Math.max(1, Number(url.searchParams.get("days") ?? 14)));

  if (!serviceId) {
    return NextResponse.json({ error: "service_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: instance } = await admin
    .from("widget_instances")
    .select("id, enabled, config")
    .eq("id", instanceId)
    .maybeSingle();

  if (!instance || !instance.enabled) {
    return NextResponse.json({ error: "Widget unavailable" }, { status: 404 });
  }

  // Entitlement gate — no live subscription ⇒ nothing bookable.
  const { data: hasAccess } = await admin.rpc("has_widget_access", {
    p_instance_id: instanceId,
  });
  if (!hasAccess) return NextResponse.json({ slots: [] });

  const config = normalizeCalendarConfig(instance.config);
  const service = config.services.find((s) => s.id === serviceId);
  if (!service) {
    return NextResponse.json({ error: "Unknown service" }, { status: 400 });
  }

  const fromDate = url.searchParams.get("from") ?? todayInZone(config.timezone);

  // Existing confirmed bookings that could clash within the window.
  const windowStart = new Date(`${fromDate}T00:00:00Z`).toISOString();
  const windowEnd = new Date(Date.now() + (days + 2) * 86_400_000).toISOString();
  const { data: bookings } = await admin
    .from("widget_bookings")
    .select("starts_at, ends_at, staff_id")
    .eq("instance_id", instanceId)
    .eq("status", "confirmed")
    .gte("starts_at", windowStart)
    .lte("starts_at", windowEnd);

  const slots = computeAvailableSlots({
    config,
    service,
    fromDate,
    days,
    existingBookings: bookings ?? [],
    minLeadMinutes: 60,
    staffId: staffId || null,
  });

  return NextResponse.json({
    timezone: config.timezone,
    service: { id: service.id, name: service.name, duration_min: service.duration_min },
    staff: config.staff,
    slots,
  });
}
