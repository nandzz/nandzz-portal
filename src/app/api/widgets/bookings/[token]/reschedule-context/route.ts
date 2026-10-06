import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { eligibleStaffForService, normalizeCalendarConfig } from "@/lib/widgets/calendar";
import type { CalendarCategory, CalendarService, StaffMember, WidgetBooking } from "@/lib/types";

// Public (token-scoped): what the reschedule picker needs to offer a per-service
// staff choice — each booked service with its currently-assigned staff and the
// specialists eligible for it. `needs_staff_step` is true when at least one
// service has a real choice (2+ eligible), so the picker knows whether to show
// the staff step at all (mirrors the booking flow's gating). `catalog` is the
// full bookable service list (same scope as the booking flow) so the picker can
// also let the customer/owner CHANGE the services while rescheduling.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("widget_bookings")
    .select("id, location_id, service_id, service_name, staff_id, status, instance:widget_instances(config, enabled)")
    .eq("manage_token", token)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const booking = data as unknown as Pick<
    WidgetBooking,
    "id" | "location_id" | "service_id" | "service_name" | "staff_id" | "status"
  >;
  const instance = (data as { instance?: { config?: unknown; enabled?: boolean } }).instance;
  if (!instance?.enabled) return NextResponse.json({ error: "Booking widget unavailable." }, { status: 409 });
  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "This booking was cancelled." }, { status: 409 });
  }

  const config = normalizeCalendarConfig(instance.config);
  const location = booking.location_id
    ? config.locations.find((l) => l.id === booking.location_id)
    : undefined;
  const services: CalendarService[] = location ? location.services : config.services;
  const staffSource: StaffMember[] = location ? location.staff : config.staff;

  const { data: segData } = await admin
    .from("widget_booking_segments")
    .select("service_id, service_name, staff_id, seq")
    .eq("booking_id", booking.id)
    .eq("status", "confirmed")
    .order("seq", { ascending: true });
  const segs = (segData ?? []) as { service_id: string; service_name: string; staff_id: string | null }[];
  const source =
    segs.length > 0
      ? segs
      : [{ service_id: booking.service_id, service_name: booking.service_name, staff_id: booking.staff_id }];

  const eligibleFor = (svc: CalendarService | undefined) =>
    (svc ? eligibleStaffForService(staffSource, svc) : []).map((m) => ({
      id: m.id,
      name: m.name,
      photo_url: m.photo_url ?? null,
      info: m.info ?? null,
    }));

  const servicesOut = source.map((seg) => ({
    service_id: seg.service_id,
    name: seg.service_name,
    current_staff_id: seg.staff_id,
    eligible_staff: eligibleFor(services.find((s) => s.id === seg.service_id)),
  }));

  const catalog = services.map((s) => ({
    id: s.id,
    name: s.name,
    duration_min: s.duration_min,
    price_cents: s.price_cents ?? null,
    category_id: s.category_id ?? null,
    eligible_staff: eligibleFor(s),
  }));
  const categories: CalendarCategory[] = (location ? location.categories : config.categories) ?? [];

  const needs_staff_step = servicesOut.some((s) => s.eligible_staff.length > 1);
  return NextResponse.json({
    services: servicesOut,
    needs_staff_step,
    catalog,
    categories,
    show_prices: config.show_prices,
    currency: config.currency,
  });
}
