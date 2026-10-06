import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeCalendarConfig, staffAvailabilityForWindow } from "@/features/booking/domain/calendar";
import type { CalendarService, StaffMember, WidgetBooking } from "@/lib/types";

// Owner-only: for a booking, list — PER booked service — EVERY in-scope staff
// member with their availability for that service's window, and, for anyone who
// can't take it, the reason (busy with which booking / not working / not
// eligible). Powers the rich "Assign staff" dialog: full roster, transparent
// status, so reassignment is never silently limited to a filtered subset.

type SegRow = {
  service_id: string;
  service_name: string;
  duration_min: number;
  price_cents: number | null;
  parallel: boolean;
  seq: number;
  staff_id: string | null;
  starts_at: string;
  ends_at: string;
};

// A confirmed segment on someone else's booking, with just enough of its parent
// to explain the clash ("busy with {customer} at {time}").
type BusyRow = {
  staff_id: string | null;
  starts_at: string;
  ends_at: string;
  service_name: string;
  booking: { customer_name: string } | { customer_name: string }[] | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("widget_bookings")
    .select("id, owner_user_id, status, instance_id, location_id, instance:widget_instances(config)")
    .eq("manage_token", token)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const booking = data as unknown as Pick<
    WidgetBooking,
    "id" | "owner_user_id" | "status" | "instance_id" | "location_id"
  >;

  // Owner-only.
  let userId: string | null = null;
  try {
    const ssr = await createClient();
    const {
      data: { user },
    } = await ssr.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId || userId !== booking.owner_user_id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const config = normalizeCalendarConfig((data as { instance?: { config?: unknown } }).instance?.config);
  const location = booking.location_id
    ? config.locations.find((l) => l.id === booking.location_id)
    : undefined;
  const services: CalendarService[] = location ? location.services : config.services;
  const staffSource: StaffMember[] = location ? location.staff : config.staff;
  const timezone = location?.timezone ?? config.timezone;

  // The booking's own segments (each carries its own window + current staff).
  const { data: segData } = await admin
    .from("widget_booking_segments")
    .select("service_id, service_name, duration_min, price_cents, parallel, seq, staff_id, starts_at, ends_at")
    .eq("booking_id", booking.id)
    .eq("status", "confirmed")
    .order("seq", { ascending: true });
  const segments = (segData ?? []) as SegRow[];

  // Nothing to reassign against (unstaffed business) → empty roster.
  if (staffSource.length === 0 || segments.length === 0) {
    return NextResponse.json({ timezone, services: [] });
  }

  // All OTHER confirmed segments near this booking, scoped to the location
  // bucket, joined to their parent's customer name for the "busy with …" reason.
  const starts = segments.map((s) => new Date(s.starts_at).getTime());
  const minStart = Math.min(...starts);
  const maxStart = Math.max(...starts);
  let busyQuery = admin
    .from("widget_booking_segments")
    .select("staff_id, starts_at, ends_at, service_name, booking:widget_bookings(customer_name)")
    .eq("instance_id", booking.instance_id)
    .eq("status", "confirmed")
    .neq("booking_id", booking.id)
    .gte("starts_at", new Date(minStart - 86_400_000).toISOString())
    .lte("starts_at", new Date(maxStart + 86_400_000).toISOString());
  busyQuery = location ? busyQuery.eq("location_id", location.id) : busyQuery.is("location_id", null);
  const { data: busyData } = await busyQuery;
  const busy = (busyData ?? []) as BusyRow[];

  const staffById = new Map(staffSource.map((s) => [s.id, s]));

  const servicesOut = segments.map((seg) => {
    const service = services.find((s) => s.id === seg.service_id) ?? {
      // Config-edited-away service: fall back to the segment snapshot so the
      // owner can still see/reassign it. No staff_ids ⇒ everyone eligible.
      id: seg.service_id,
      name: seg.service_name,
      duration_min: seg.duration_min,
      price_cents: seg.price_cents,
    };

    const statuses = staffAvailabilityForWindow({
      config,
      service,
      startIso: seg.starts_at,
      endIso: seg.ends_at,
      existingBusy: busy.map((b) => ({ staff_id: b.staff_id, starts_at: b.starts_at, ends_at: b.ends_at })),
      location,
    });

    const options = statuses.map((st) => {
      const member = staffById.get(st.staff_id);
      let busyWith: { customer_name: string; service_name: string; starts_at: string; ends_at: string } | null = null;
      if (st.conflict_index !== null) {
        const b = busy[st.conflict_index];
        const parent = Array.isArray(b.booking) ? b.booking[0] : b.booking;
        busyWith = {
          customer_name: parent?.customer_name ?? "",
          service_name: b.service_name,
          starts_at: b.starts_at,
          ends_at: b.ends_at,
        };
      }
      return {
        id: st.staff_id,
        name: member?.name ?? "",
        photo_url: member?.photo_url ?? null,
        info: member?.info ?? null,
        eligible: st.eligible,
        working: st.working,
        assignable: st.assignable,
        is_current: st.staff_id === seg.staff_id,
        busy_with: busyWith,
      };
    });

    return { service_id: seg.service_id, name: seg.service_name, current_staff_id: seg.staff_id, options };
  });

  return NextResponse.json({ timezone, services: servicesOut });
}
