import { NextRequest, NextResponse } from "next/server";
import { computeSegmentedSlots, todayInZone } from "@/features/booking/domain/calendar";
import { loadRescheduleContext, isLoadError, parseServicesParam, parseStaffParam } from "../_shared";

// Open start times a booking can be RESCHEDULED to — the whole booking (its
// existing per-service staff + durations) shifted to a new start. Powers the
// reschedule picker on both the customer manage page and the owner dashboard.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const url = new URL(req.url);
  const days = Math.min(60, Math.max(1, Number(url.searchParams.get("days") ?? 60)));
  // Optional per-service staff re-selection (defaults to the booking's current
  // staff when absent), so the reschedule picker can show times for a changed
  // specialist just like the booking flow.
  const staffOverride = parseStaffParam(url.searchParams.get("staff"));
  // Optional new service selection (reschedule may also change the services).
  const serviceIds = parseServicesParam(url.searchParams.get("services"));

  const ctx = await loadRescheduleContext(token, staffOverride, serviceIds);
  if (isLoadError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { admin, booking, config, location, choices } = ctx;

  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "This booking was cancelled." }, { status: 409 });
  }

  const timezone = location?.timezone ?? config.timezone;
  const fromDate = todayInZone(timezone);
  const windowStart = new Date(`${fromDate}T00:00:00Z`).toISOString();
  const windowEnd = new Date(
    new Date(`${fromDate}T00:00:00Z`).getTime() + (days + 2) * 86_400_000
  ).toISOString();

  // Everyone else's confirmed segments (exclude this booking's own).
  let busyQuery = admin
    .from("widget_booking_segments")
    .select("staff_id, starts_at, ends_at")
    .eq("instance_id", booking.instance_id)
    .eq("status", "confirmed")
    .neq("booking_id", booking.id)
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

  return NextResponse.json({ timezone, slots });
}
