import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { mapBookingError } from "@/lib/widgets/booking-errors";
import type { WidgetBooking } from "@/lib/types";

// Owner-only: reassign the staff member responsible for ONE service on a
// booking, WITHOUT moving the time ("change only the staff member responsible
// for a specific service"). This route enforces ownership; the DB enforces that
// the new staff is free for that service's window (time clashes only — the owner
// may otherwise override eligibility/working hours for flexibility).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { service_id, staff_id } = (await req.json()) as {
    service_id?: string;
    staff_id?: string;
  };
  if (!service_id || !staff_id) {
    return NextResponse.json({ error: "service_id and staff_id are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("widget_bookings")
    .select("id, owner_user_id, status")
    .eq("manage_token", token)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const booking = data as unknown as Pick<WidgetBooking, "id" | "owner_user_id" | "status">;

  // Only the business owner may reassign staff.
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
  if (booking.status !== "confirmed") {
    return NextResponse.json({ error: "This booking was cancelled." }, { status: 409 });
  }

  // Flexibility over rigidity: the owner may assign ANY staff member on file,
  // even one not normally eligible for this service or outside their usual hours
  // (they know their business). The only hard block is a real time clash, which
  // the RPC enforces via the exclusion constraint (→ STAFF_UNAVAILABLE). The
  // RPC also rejects a staff id that doesn't exist in the instance config.
  const { data: row, error } = await admin
    .rpc("set_booking_segment_staff_tx", {
      p_token: token,
      p_service_id: service_id,
      p_staff_id: staff_id,
    })
    .single<WidgetBooking>();

  if (error || !row) {
    const mapped = mapBookingError(error?.message);
    return NextResponse.json({ error: mapped.code }, { status: mapped.status });
  }

  return NextResponse.json({
    ok: true,
    staff_id: row.staff_id,
    staff_name: row.staff_name,
    services: row.services ?? null,
  });
}
