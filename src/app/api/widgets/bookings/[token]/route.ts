import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeAvailableSlots,
  eligibleStaffForService,
  normalizeCalendarConfig,
  todayInZone,
} from "@/lib/widgets/calendar";
import { currencySymbol } from "@/lib/widgets/messages";
import { dispatchBookingMessage } from "@/lib/widgets/notify";
import type { WidgetBooking } from "@/lib/types";

// Customer self-serve: view / reschedule / cancel a booking by its unguessable
// manage_token. No login — the token is the authorization. Uses the
// service-role client (customers have no RLS grant on widget_bookings).

async function loadBooking(token: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("widget_bookings")
    .select(
      "*, instance:widget_instances(config, enabled, owner:profiles(display_name, username), catalog:widget_catalog(currency))"
    )
    .eq("manage_token", token)
    .maybeSingle();
  return { admin, data };
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
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { data } = await loadBooking(token);
  if (!data) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const booking = data as unknown as WidgetBooking;
  return NextResponse.json(present(booking, (data as { instance?: unknown }).instance as never));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { admin, data } = await loadBooking(token);
  if (!data) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const booking = data as unknown as WidgetBooking;
  const alreadyCancelled = booking.status === "cancelled";

  const { error } = await admin
    .from("widget_bookings")
    .update({ status: "cancelled" })
    .eq("manage_token", token);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the customer with the owner-configured cancellation message — but
  // only on the first transition, so a double-cancel doesn't re-message.
  if (!alreadyCancelled) {
    const instance = (data as {
      instance?: {
        config?: unknown;
        owner?: { display_name?: string; username?: string } | null;
        catalog?: { currency?: string } | null;
      };
    }).instance;
    const config = normalizeCalendarConfig(instance?.config);
    const owner = instance?.owner ?? null;
    const businessName = owner?.display_name || owner?.username || "your provider";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    await dispatchBookingMessage(config.messages.cancellation, {
      customerName: booking.customer_name,
      customerEmail: booking.customer_email,
      customerPhone: booking.customer_phone,
      businessName,
      serviceName: booking.service_name,
      startsAt: booking.starts_at,
      timezone: config.timezone,
      priceCents: booking.price_cents,
      currencySymbol: currencySymbol(instance?.catalog?.currency),
      manageUrl: `${siteUrl}/booking/${token}`,
      staffName: booking.staff_name ?? null,
    });
  }

  return NextResponse.json({ ok: true, status: "cancelled" });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  // `staff_id` is optional: omitted ⇒ keep the booking's current staff (back-compat);
  // "" ⇒ "any available" (auto-assign, mirroring create_booking_tx); a specific id ⇒
  // that specialist, validated against the target slot's free candidates below.
  const { starts_at, staff_id: staffIdRaw } = (await req.json()) as {
    starts_at?: string;
    staff_id?: string | null;
  };
  if (!starts_at) return NextResponse.json({ error: "starts_at is required" }, { status: 400 });

  const { admin, data } = await loadBooking(token);
  if (!data) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const booking = data as unknown as WidgetBooking;
  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "This booking was cancelled." }, { status: 409 });
  }

  const instance = (data as { instance?: { config?: unknown; enabled?: boolean } }).instance;
  if (!instance?.enabled) {
    return NextResponse.json({ error: "Booking widget unavailable." }, { status: 409 });
  }

  const config = normalizeCalendarConfig(instance.config);
  const location = booking.location_id
    ? config.locations.find((l) => l.id === booking.location_id)
    : undefined;
  const services = location ? location.services : config.services;
  const service = services.find((s) => s.id === booking.service_id);
  if (!service) {
    return NextResponse.json({ error: "This service is no longer offered." }, { status: 409 });
  }

  const requestedIso = new Date(starts_at).toISOString();
  const fromDate = todayInZone(config.timezone, new Date(starts_at));

  // Other confirmed bookings (exclude this one) in the target date's neighborhood,
  // scoped to the same location bucket as the availability route (see its comment).
  let othersQuery = admin
    .from("widget_bookings")
    .select("starts_at, ends_at, staff_id")
    .eq("instance_id", booking.instance_id)
    .eq("status", "confirmed")
    .neq("id", booking.id);
  othersQuery = location
    ? othersQuery.eq("location_id", location.id)
    : othersQuery.is("location_id", null);
  const { data: others } = await othersQuery;

  // Unrestricted (no staffId filter) so each slot's `staff_ids` lists every
  // free-and-eligible candidate — that list doubles as who's available to
  // (re)assign below, the same set create_booking_tx would auto-pick from.
  const slots = computeAvailableSlots({
    config,
    service,
    fromDate,
    days: 2,
    existingBookings: others ?? [],
    minLeadMinutes: 60,
    location,
  });

  const targetSlot = slots.find((s) => s.start === requestedIso);
  if (!targetSlot) {
    return NextResponse.json({ error: "That time isn't available." }, { status: 409 });
  }

  const staffSource = location ? location.staff : config.staff;
  const eligible = eligibleStaffForService(staffSource, service);
  const staffMode = eligible.length > 0;

  // Explicit request wins ("" ⇒ any available); omitted ⇒ keep the current staff.
  const requestedStaffId = staffIdRaw !== undefined ? staffIdRaw || null : booking.staff_id;

  let candidateIds: (string | null)[];
  if (!staffMode) {
    candidateIds = [null];
  } else if (requestedStaffId) {
    if (!targetSlot.staff_ids?.includes(requestedStaffId)) {
      return NextResponse.json(
        { error: "That specialist isn't free at that time." },
        { status: 409 }
      );
    }
    candidateIds = [requestedStaffId];
  } else {
    candidateIds = targetSlot.staff_ids ?? [];
  }

  const newEnds = new Date(new Date(requestedIso).getTime() + service.duration_min * 60_000).toISOString();

  // Try each free candidate in turn — the exclusion constraint rejects one that
  // was just grabbed for an overlapping range, so we fall through to the next
  // (same optimistic-retry shape as create_booking_tx's candidate loop).
  let updated: { starts_at: string; ends_at: string; staff_id: string | null; staff_name: string | null } | null =
    null;
  let lastErrorCode: string | undefined;
  for (const candidateId of candidateIds) {
    const candidateName = candidateId ? staffSource.find((m) => m.id === candidateId)?.name ?? null : null;
    const { data: row, error } = await admin
      .from("widget_bookings")
      .update({ starts_at: requestedIso, ends_at: newEnds, staff_id: candidateId, staff_name: candidateName })
      .eq("manage_token", token)
      .eq("status", "confirmed")
      .select("starts_at, ends_at, staff_id, staff_name")
      .maybeSingle();
    if (!error && row) {
      updated = row;
      break;
    }
    lastErrorCode = (error as { code?: string } | null)?.code;
    if (lastErrorCode !== "23P01") break; // not a slot clash — no point retrying
  }

  if (!updated) {
    // 23P01 = exclusion_violation → every candidate was grabbed first.
    const status = lastErrorCode === "23P01" ? 409 : 500;
    const message = status === 409 ? "That slot was just taken. Please pick another." : "Failed to reschedule.";
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true, ...updated });
}
