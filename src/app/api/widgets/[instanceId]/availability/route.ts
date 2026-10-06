import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserEntitlements } from "@/lib/plan";
import {
  computeSegmentedSlots,
  normalizeCalendarConfig,
  todayInZone,
  type ServiceChoice,
} from "@/features/booking/domain/calendar";

// Public: open whole-booking slots for a per-service-staffed selection over a
// date window. No auth — visitors (and the AI chat) need to see availability.
// Reads with the service-role client; entitlement is enforced here so an unpaid
// widget shows nothing bookable.
//
// Query params:
//   service_ids  — comma-separated, ORDER-preserving (drives sequential layout).
//                  `service_id` (single) stays supported for the legacy/AI path.
//   staff        — per-service staff choices as `svcId:staffId` pairs joined by
//                  commas; an empty staffId (`svcId:`) or an omitted service ⇒
//                  "any available" (auto-assigned). e.g. `s1:st_a,s2:`.
//   location_id  — the location subtree, when the instance uses locations.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const { instanceId } = await params;
  const url = new URL(req.url);
  const serviceIdsParam = url.searchParams.get("service_ids");
  const serviceId = url.searchParams.get("service_id");
  const requestedServiceIds = (serviceIdsParam ?? serviceId ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const locationId = url.searchParams.get("location_id");
  const days = Math.min(60, Math.max(1, Number(url.searchParams.get("days") ?? 14)));

  // Parse the per-service staff choices.
  const staffByService = new Map<string, string>();
  for (const pair of (url.searchParams.get("staff") ?? "").split(",")) {
    if (!pair) continue;
    const idx = pair.indexOf(":");
    if (idx < 0) continue;
    const svc = pair.slice(0, idx).trim();
    const st = pair.slice(idx + 1).trim();
    if (svc) staffByService.set(svc, st);
  }
  // Legacy single-staff choice (manual booking modal): apply it to every service
  // when no per-service map is given.
  const legacyStaffId = (url.searchParams.get("staff_id") ?? "").trim();

  if (requestedServiceIds.length === 0) {
    return NextResponse.json({ error: "service_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: instance } = await admin
    .from("widget_instances")
    .select("id, enabled, config, user_id")
    .eq("id", instanceId)
    .maybeSingle();

  if (!instance || !instance.enabled) {
    return NextResponse.json({ error: "Widget unavailable" }, { status: 404 });
  }

  // Entitlement gate — the owner's plan must include widgets, else nothing bookable.
  const entitlements = await getUserEntitlements(instance.user_id as string);
  if (!entitlements.hasWidgets) return NextResponse.json({ slots: [] });

  const config = normalizeCalendarConfig(instance.config);

  const location = locationId ? config.locations.find((l) => l.id === locationId) : undefined;
  if (locationId && !location) {
    return NextResponse.json({ error: "Unknown location" }, { status: 400 });
  }
  const services = location ? location.services : config.services;

  // Resolve every requested service (order preserved) and pair it with its
  // per-service staff choice.
  const selected = requestedServiceIds.map((id) => services.find((s) => s.id === id));
  if (selected.some((s) => !s)) {
    return NextResponse.json({ error: "Unknown service" }, { status: 400 });
  }
  const choices: ServiceChoice[] = (selected as NonNullable<(typeof selected)[number]>[]).map((s) => ({
    service: s,
    staffId: staffByService.get(s.id) || legacyStaffId || undefined,
  }));

  const timezone = location?.timezone ?? config.timezone;
  const fromDate = url.searchParams.get("from") ?? todayInZone(timezone);

  // Existing confirmed SEGMENTS that could clash within the window — the source
  // of overlap truth (see 20260901120000). Scoped to the same location bucket as
  // the booking (staffed clashes are disambiguated by staff_id; an unstaffed
  // location is its own resource).
  const windowStart = new Date(`${fromDate}T00:00:00Z`).toISOString();
  const windowEnd = new Date(
    new Date(`${fromDate}T00:00:00Z`).getTime() + (days + 2) * 86_400_000
  ).toISOString();
  let busyQuery = admin
    .from("widget_booking_segments")
    .select("staff_id, starts_at, ends_at")
    .eq("instance_id", instanceId)
    .eq("status", "confirmed")
    .gte("starts_at", windowStart)
    .lte("starts_at", windowEnd);
  busyQuery = location ? busyQuery.eq("location_id", location.id) : busyQuery.is("location_id", null);
  const { data: busy } = await busyQuery;

  const slots = computeSegmentedSlots({
    config,
    choices,
    fromDate,
    days,
    existingBusy: busy ?? [],
    minLeadMinutes: 60,
    location,
  });

  return NextResponse.json({
    timezone,
    staff: location ? location.staff : config.staff,
    slots,
  });
}
