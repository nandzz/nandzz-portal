import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeCalendarConfig,
  resolveSegmentPlan,
  type ServiceChoice,
} from "@/features/booking/domain/calendar";
import { isLoadError, loadRescheduleContext } from "@/app/api/widgets/bookings/[token]/_shared";
import type { WidgetBooking } from "@/lib/types";

// Carries out an approval the owner just approved, re-checked against the live
// calendar with the same engine as the web booking routes (resolveSegmentPlan →
// create_booking_tx / reschedule_booking_tx). The approval is already claimed
// (status = approved) by the caller, so this runs at most once per approval.

export type ClaimedApproval = {
  id: string;
  owner_user_id: string;
  thread_id: string;
  kind: "new_booking" | "reschedule" | "cancel";
  booking_id: string | null;
  request: {
    service_ids?: string[];
    starts_at?: string;
    location_id?: string | null;
    staff_id?: string | null;
    customer_name?: string | null;
    locale?: string | null;
  };
  thread: { customer_wa_id: string; customer_name: string | null; connection: { widget_instance_id: string | null } };
};

export type ExecuteOutcome =
  | { ok: true; bookingId: string; summary: string }
  | { ok: false; outcome: "slot_taken" | "out_of_hours" | "booking_gone" | "error" };

type Admin = ReturnType<typeof createAdminClient>;

const fmt = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

// Busy segments near `startIso` in the booking's location bucket, minus one
// booking (reschedule) — the same window the web routes read.
async function busyAround(admin: Admin, instanceId: string, locationId: string | null, startIso: string, excludeId?: string) {
  const startMs = new Date(startIso).getTime();
  let q = admin
    .from("widget_booking_segments")
    .select("staff_id, starts_at, ends_at")
    .eq("instance_id", instanceId)
    .eq("status", "confirmed")
    .gte("starts_at", new Date(startMs - 2 * 86_400_000).toISOString())
    .lte("starts_at", new Date(startMs + 2 * 86_400_000).toISOString());
  if (excludeId) q = q.neq("booking_id", excludeId);
  q = locationId ? q.eq("location_id", locationId) : q.is("location_id", null);
  const { data } = await q;
  return data ?? [];
}

const planFailure = (reason: string): ExecuteOutcome => ({
  ok: false,
  outcome: reason === "OUT_OF_HOURS" || reason === "BLACKOUT" ? "out_of_hours" : "slot_taken",
});

const rpcFailure = (message?: string): ExecuteOutcome => ({
  ok: false,
  outcome: message?.includes("SLOT_TAKEN") || message?.includes("STAFF_UNAVAILABLE") ? "slot_taken" : "error",
});

async function createBooking(admin: Admin, a: ClaimedApproval): Promise<ExecuteOutcome> {
  const instanceId = a.thread.connection.widget_instance_id;
  const { service_ids = [], starts_at, location_id = null, staff_id = null } = a.request;
  if (!instanceId || !starts_at || service_ids.length === 0) return { ok: false, outcome: "error" };
  if (new Date(starts_at).getTime() < Date.now() + 30 * 60_000) return { ok: false, outcome: "out_of_hours" };

  const { data: instance } = await admin
    .from("widget_instances")
    .select("id, enabled, config, user_id")
    .eq("id", instanceId)
    .maybeSingle();
  if (!instance || !instance.enabled || instance.user_id !== a.owner_user_id) return { ok: false, outcome: "error" };

  const config = normalizeCalendarConfig(instance.config);
  const location = location_id ? config.locations.find((l) => l.id === location_id) : undefined;
  if (location_id && !location) return { ok: false, outcome: "error" };
  const services = location ? location.services : config.services;
  const choices: ServiceChoice[] = [];
  for (const id of service_ids) {
    const service = services.find((s) => s.id === id);
    if (!service) return { ok: false, outcome: "error" };
    choices.push({ service, staffId: staff_id || undefined });
  }

  const startIso = new Date(starts_at).toISOString();
  const plan = resolveSegmentPlan({
    config,
    choices,
    startIso,
    existingBusy: await busyAround(admin, instanceId, location_id, startIso),
    location,
  });
  if (!plan.ok) return planFailure(plan.reason);

  const { data: booking, error } = await admin
    .rpc("create_booking_tx", {
      p_instance_id: instanceId,
      p_service_id: service_ids[0],
      p_service_ids: service_ids,
      p_starts_at: startIso,
      p_customer_name: a.request.customer_name || a.thread.customer_name || "WhatsApp customer",
      p_customer_email: null,
      p_customer_phone: `+${a.thread.customer_wa_id}`,
      p_staff_id: staff_id,
      p_location_id: location_id,
      p_locale: a.request.locale ?? null,
      p_segments: plan.segments,
    })
    .single<WidgetBooking>();
  if (error || !booking) return rpcFailure(error?.message);

  await admin.from("widget_bookings").update({ agent_thread_id: a.thread_id }).eq("id", booking.id);
  return { ok: true, bookingId: booking.id, summary: `${booking.service_name}, ${fmt(booking.starts_at, location?.timezone || config.timezone)}` };
}

// The booking must still belong to this chat and be upcoming.
async function ownBooking(admin: Admin, a: ClaimedApproval) {
  if (!a.booking_id) return null;
  const { data } = await admin
    .from("widget_bookings")
    .select("id, manage_token, status, starts_at, service_name")
    .eq("id", a.booking_id)
    .eq("owner_user_id", a.owner_user_id)
    .eq("agent_thread_id", a.thread_id)
    .maybeSingle();
  if (!data || data.status !== "confirmed" || new Date(data.starts_at).getTime() <= Date.now()) return null;
  return data as { id: string; manage_token: string; service_name: string; starts_at: string };
}

async function reschedule(admin: Admin, a: ClaimedApproval): Promise<ExecuteOutcome> {
  const current = await ownBooking(admin, a);
  if (!current) return { ok: false, outcome: "booking_gone" };
  if (!a.request.starts_at) return { ok: false, outcome: "error" };
  const startIso = new Date(a.request.starts_at).toISOString();
  if (new Date(startIso).getTime() < Date.now() + 30 * 60_000) return { ok: false, outcome: "out_of_hours" };

  // Same services and staff, shifted (as the customer reschedule route does).
  const ctx = await loadRescheduleContext(current.manage_token);
  if (isLoadError(ctx)) return { ok: false, outcome: "booking_gone" };
  const plan = resolveSegmentPlan({
    config: ctx.config,
    choices: ctx.choices,
    startIso,
    existingBusy: await busyAround(admin, ctx.booking.instance_id, ctx.booking.location_id ?? null, startIso, current.id),
    location: ctx.location,
  });
  if (!plan.ok) return planFailure(plan.reason);

  const { data: row, error } = await admin
    .rpc("reschedule_booking_tx", {
      p_token: current.manage_token,
      p_starts_at: startIso,
      p_segments: plan.segments,
      p_actor: "owner",
    })
    .single<WidgetBooking>();
  if (error || !row) return rpcFailure(error?.message);
  return { ok: true, bookingId: row.id, summary: `${row.service_name} moved to ${fmt(row.starts_at, ctx.location?.timezone || ctx.config.timezone)}` };
}

async function cancel(admin: Admin, a: ClaimedApproval): Promise<ExecuteOutcome> {
  const current = await ownBooking(admin, a);
  if (!current) return { ok: false, outcome: "booking_gone" };
  // Same path as the web cancel route: the status change fires the emails.
  const { error } = await admin
    .from("widget_bookings")
    .update({ status: "cancelled", notify_actor: "owner" })
    .eq("id", current.id)
    .eq("status", "confirmed");
  if (error) return { ok: false, outcome: "error" };
  return { ok: true, bookingId: current.id, summary: current.service_name };
}

export async function executeApproval(a: ClaimedApproval): Promise<ExecuteOutcome> {
  const admin = createAdminClient();
  switch (a.kind) {
    case "new_booking":
      return createBooking(admin, a);
    case "reschedule":
      return reschedule(admin, a);
    case "cancel":
      return cancel(admin, a);
  }
}
