import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSessionOwner } from "@/features/booking/data/session-owner";
import type { BookingAttendance } from "@/lib/types";

// Owner-only: mark whether the client showed up (attended / no_show), or clear
// the mark (null). Only for confirmed bookings that have already started.
const VALUES: (BookingAttendance | null)[] = ["attended", "no_show", null];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { attendance } = (await req.json().catch(() => ({}))) as { attendance?: unknown };
  if (!VALUES.includes(attendance as BookingAttendance | null)) {
    return NextResponse.json({ error: "INVALID_ATTENDANCE" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("widget_bookings")
    .select("id, owner_user_id, status, starts_at")
    .eq("manage_token", token)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!(await isSessionOwner(booking.owner_user_id as string))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (booking.status !== "confirmed" || new Date(booking.starts_at as string).getTime() > Date.now()) {
    return NextResponse.json({ error: "NOT_STARTED" }, { status: 409 });
  }

  const { error } = await admin
    .from("widget_bookings")
    .update({ attendance })
    .eq("id", booking.id);
  if (error) {
    console.error("[bookings/attendance] update failed:", error);
    return NextResponse.json({ error: "GENERIC" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, attendance });
}
