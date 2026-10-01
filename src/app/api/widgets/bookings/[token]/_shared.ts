import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCalendarConfig, type ServiceChoice } from "@/lib/widgets/calendar";
import type { CalendarConfig, Location, WidgetBooking } from "@/lib/types";

// Shared reschedule/reassign context for the token-scoped booking routes. A
// booking reschedules as its EXISTING segments (same per-service staff,
// durations and parallel layout) shifted to a new start — so the choices are
// built from the stored segment rows, each pinned to its assigned staff. The
// engine then validates a candidate start against those pins.

type SegRow = {
  service_id: string;
  service_name: string;
  duration_min: number;
  price_cents: number | null;
  parallel: boolean;
  seq: number;
  staff_id: string | null;
};

export type RescheduleContext = {
  admin: ReturnType<typeof createAdminClient>;
  booking: WidgetBooking;
  config: CalendarConfig;
  location?: Location;
  choices: ServiceChoice[];
};

export type LoadError = { error: string; status: number };

export function isLoadError(v: RescheduleContext | LoadError): v is LoadError {
  return (v as LoadError).error !== undefined;
}

// Parse the `staff` query param (`svcId:staffId` pairs, comma-joined) into a
// per-service override map. An empty staffId (`svcId:`) maps to "" (any).
export function parseStaffParam(raw: string | null): Record<string, string> {
  const map: Record<string, string> = {};
  for (const pair of (raw ?? "").split(",")) {
    if (!pair) continue;
    const idx = pair.indexOf(":");
    if (idx < 0) continue;
    const svc = pair.slice(0, idx).trim();
    if (svc) map[svc] = pair.slice(idx + 1).trim();
  }
  return map;
}

// `staffOverride` (per-service `{ serviceId: staffId | "" }`) lets a reschedule
// ALSO re-choose who handles a service: an entry replaces that segment's pinned
// staff with the caller's choice ("" ⇒ any eligible, auto-assigned). A service
// with no entry keeps its current staff (the default — reschedule preserves
// assignments). Absent/empty override ⇒ every service keeps its current staff.
export async function loadRescheduleContext(
  token: string,
  staffOverride?: Record<string, string>
): Promise<RescheduleContext | LoadError> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("widget_bookings")
    .select("*, instance:widget_instances(config, enabled)")
    .eq("manage_token", token)
    .maybeSingle();
  if (!data) return { error: "Booking not found", status: 404 };

  const booking = data as unknown as WidgetBooking;
  const instance = (data as { instance?: { config?: unknown; enabled?: boolean } }).instance;
  if (!instance?.enabled) return { error: "Booking widget unavailable.", status: 409 };

  const config = normalizeCalendarConfig(instance.config);
  const location = booking.location_id
    ? config.locations.find((l) => l.id === booking.location_id)
    : undefined;

  const { data: segRows } = await admin
    .from("widget_booking_segments")
    .select("service_id, service_name, duration_min, price_cents, parallel, seq, staff_id")
    .eq("booking_id", booking.id)
    .eq("status", "confirmed")
    .order("seq", { ascending: true });

  const segs = (segRows ?? []) as SegRow[];
  // Defensive fallback for any pre-segments row that never got backfilled:
  // reconstruct one segment from the aggregate columns.
  const source: SegRow[] =
    segs.length > 0
      ? segs
      : [
          {
            service_id: booking.service_id,
            service_name: booking.service_name,
            duration_min: booking.duration_min,
            price_cents: booking.price_cents,
            parallel: false,
            seq: 0,
            staff_id: booking.staff_id,
          },
        ];

  const configServices = location ? location.services : config.services;

  const choices: ServiceChoice[] = source.map((seg) => {
    const override = staffOverride?.[seg.service_id];
    if (override !== undefined) {
      // The caller re-chose this service's staff. Use the config service's FULL
      // eligible set (so "any" can auto-assign anyone qualified, and a specific
      // pick is validated against it), keeping the segment's reserved duration.
      const cfgSvc = configServices.find((s) => s.id === seg.service_id);
      return {
        service: {
          id: seg.service_id,
          name: seg.service_name,
          duration_min: seg.duration_min,
          price_cents: seg.price_cents,
          parallel: seg.parallel,
          staff_ids: cfgSvc?.staff_ids,
        },
        staffId: override || undefined, // "" ⇒ any available
      };
    }
    // Default: keep the current staff pinned so the reschedule preserves the
    // assignment; an unstaffed segment leaves staff open.
    return {
      service: {
        id: seg.service_id,
        name: seg.service_name,
        duration_min: seg.duration_min,
        price_cents: seg.price_cents,
        parallel: seg.parallel,
        staff_ids: seg.staff_id ? [seg.staff_id] : undefined,
      },
      staffId: seg.staff_id ?? undefined,
    };
  });

  return { admin, booking, config, location, choices };
}
