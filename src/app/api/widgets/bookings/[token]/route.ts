import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeCalendarConfig, resolveSegmentPlan } from "@/lib/widgets/calendar";
import { BOOKING_ERROR_STATUS } from "@/lib/widgets/booking-errors";
import { loadRescheduleContext, isLoadError } from "./_shared";
import type { WidgetBooking } from "@/lib/types";

// Customer self-serve: view / reschedule / cancel a booking by its unguessable
// manage_token. No login — the token is the authorization. Uses the
// service-role client (customers have no RLS grant on widget_bookings).

async function loadBooking(token: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("widget_bookings")
    .select(
      "*, instance:widget_instances(config, enabled, owner:profiles(display_name, username))"
    )
    .eq("manage_token", token)
    .maybeSingle();
  // Surface the query error rather than swallowing it: an embed/schema failure
  // here otherwise masquerades as a 404 "Booking not found" (the caller only
  // checks `!data`), which is what it looks like when the token is genuinely
  // missing. Log it so the real cause is visible in the server console.
  if (error) console.error("loadBooking failed", error);
  return { admin, data, error };
}

// The owner dashboard cancels/reschedules through this SAME token route the
// public manage page uses, so the caller's identity is the only signal of who
// acted. If the signed-in user IS the booking's owner ⇒ the business initiated
// it (customer must be told); otherwise treat it as customer-initiated (guests
// have no session, and a customer managing their own booking isn't the owner).
// Mirrors create_booking_tx's created_by == owner heuristic.
async function resolveActor(ownerUserId: string): Promise<"business" | "customer"> {
  try {
    const ssr = await createClient();
    const {
      data: { user },
    } = await ssr.auth.getUser();
    return user?.id && user.id === ownerUserId ? "business" : "customer";
  } catch {
    return "customer";
  }
}

function present(booking: WidgetBooking, instance: { owner?: { display_name?: string; username?: string } | null; config?: unknown }) {
  const owner = instance?.owner as { display_name?: string; username?: string } | null;
  return {
    id: booking.id,
    service_name: booking.service_name,
    starts_at: booking.starts_at,
    ends_at: booking.ends_at,
    status: booking.status,
    customer_name: booking.customer_name,
    business_name: owner?.display_name || owner?.username || "your provider",
    business_username: owner?.username ?? null,
    timezone: normalizeCalendarConfig(instance?.config).timezone,
    instance_id: booking.instance_id,
    service_id: booking.service_id,
    location_id: booking.location_id,
    staff_id: booking.staff_id,
    staff_name: booking.staff_name,
    // Per-service staff breakdown (multi-service bookings); null ⇒ single service.
    services: booking.services ?? null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { data, error } = await loadBooking(token);
  // Keep the real cause in the server log (loadBooking logs it); the client gets a
  // generic message so a DB/schema failure never leaks out or masquerades as 404.
  if (error) return NextResponse.json({ error: "Unable to load booking." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const booking = data as unknown as WidgetBooking;
  return NextResponse.json(present(booking, (data as { instance?: unknown }).instance as never));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { admin, data, error: loadError } = await loadBooking(token);
  if (loadError) return NextResponse.json({ error: "Unable to load booking." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const booking = data as unknown as WidgetBooking;

  // Record who is cancelling in the same UPDATE: the DB trigger reads
  // notify_actor to decide the email recipient (owner ⇒ tell the customer;
  // customer ⇒ tell the business) and fires the edge function itself. Next never
  // calls the edge function. The trigger's OLD.status guard suppresses a repeat
  // cancel, so writing notify_actor on a double-cancel is harmless.
  const actor = await resolveActor(booking.owner_user_id);
  const { error } = await admin
    .from("widget_bookings")
    .update({ status: "cancelled", notify_actor: actor })
    .eq("manage_token", token);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: "cancelled" });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  // `staff_by_service` (optional) lets the reschedule ALSO change who handles a
  // service — mirroring the booking flow — while defaulting to the current staff
  // for any service left out. Absent ⇒ pure time move, staff preserved.
  const { starts_at, staff_by_service } = (await req.json()) as {
    starts_at?: string;
    staff_by_service?: Record<string, string>;
  };
  if (!starts_at) return NextResponse.json({ error: "starts_at is required" }, { status: 400 });

  const ctx = await loadRescheduleContext(token, staff_by_service);
  if (isLoadError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { admin, booking, config, location, choices } = ctx;

  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "This booking was cancelled." }, { status: 409 });
  }

  const requestedIso = new Date(starts_at).toISOString();
  const startMs = new Date(requestedIso).getTime();

  // Other confirmed segments (exclude THIS booking's own) near the target date,
  // scoped to the same location bucket the exclusion constraint uses.
  let busyQuery = admin
    .from("widget_booking_segments")
    .select("staff_id, starts_at, ends_at")
    .eq("instance_id", booking.instance_id)
    .eq("status", "confirmed")
    .neq("booking_id", booking.id)
    .gte("starts_at", new Date(startMs - 2 * 86_400_000).toISOString())
    .lte("starts_at", new Date(startMs + 2 * 86_400_000).toISOString());
  busyQuery = location ? busyQuery.eq("location_id", location.id) : busyQuery.is("location_id", null);
  const { data: busy } = await busyQuery;

  // Re-resolve the booking's segments (same per-service staff) at the new start.
  const plan = resolveSegmentPlan({
    config,
    choices,
    startIso: requestedIso,
    existingBusy: busy ?? [],
    location,
  });
  if (!plan.ok) {
    const status = BOOKING_ERROR_STATUS[plan.reason] ?? 409;
    return NextResponse.json({ error: "That time isn't available." }, { status });
  }

  // Record who is rescheduling: the DB trigger reads notify_actor (written inside
  // reschedule_booking_tx's single UPDATE) to pick the email recipient.
  const actor = await resolveActor(booking.owner_user_id);

  const { data: row, error } = await admin
    .rpc("reschedule_booking_tx", {
      p_token: token,
      p_starts_at: requestedIso,
      p_segments: plan.segments,
      p_actor: actor,
    })
    .single<WidgetBooking>();

  if (error || !row) {
    const clash = error?.message?.includes("SLOT_TAKEN");
    return NextResponse.json(
      { error: clash ? "That slot was just taken. Please pick another." : "Failed to reschedule." },
      { status: clash ? 409 : 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    staff_id: row.staff_id,
    staff_name: row.staff_name,
  });
}
