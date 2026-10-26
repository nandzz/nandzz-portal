import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCalendarConfig } from "@/features/booking/domain/calendar";
import type { ActivityItem, ActivityKind, ActivityTitleKey } from "../types";

// My Agent → Activity, real data: pending approvals first (actionable), then
// the latest feed events. Read with the owner's own client (RLS: owner-only).

type ThreadRef = { customer_wa_id: string; customer_name: string | null } | null;

type ApprovalRow = {
  id: string;
  kind: "new_booking" | "reschedule" | "cancel";
  request: { service_ids?: string[]; starts_at?: string; location_id?: string | null; staff_id?: string | null };
  created_at: string;
  booking: { service_name: string; starts_at: string; staff_name: string | null; location_id: string | null } | null;
  thread: ThreadRef;
};

type EventRow = {
  id: string;
  kind: string;
  summary: string;
  created_at: string;
  thread: ThreadRef;
};

// Titles are dictionary keys; the client shows them in the viewer's language.
const EVENT_VIEW: Record<string, { kind: ActivityKind; title: ActivityTitleKey } | undefined> = {
  booking_created: { kind: "booking_created", title: "titleBookingCreated" },
  booking_rescheduled: { kind: "rescheduled", title: "titleRescheduled" },
  booking_cancelled: { kind: "cancelled", title: "titleCancelled" },
  approval_requested: { kind: "approval", title: "titleApprovalRequested" },
  approval_rejected: { kind: "cancelled", title: "titleApprovalRejected" },
  approval_failed: { kind: "error", title: "titleApprovalFailed" },
  hand_off: { kind: "handoff", title: "titleHandOff" },
};

const APPROVAL_TITLE = {
  new_booking: "titlePendingNewBooking",
  reschedule: "titlePendingReschedule",
  cancel: "titlePendingCancel",
} as const satisfies Record<string, ActivityTitleKey>;

const who = (t: ThreadRef) => ({
  customer: t?.customer_name || null,
  phone: t ? `+${t.customer_wa_id}` : "",
});

const fmt = (iso: string | undefined, timeZone: string, locale: string) =>
  iso
    ? new Intl.DateTimeFormat(locale, {
        timeZone,
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(iso))
    : "";

export async function loadMyAgentActivity(supabase: SupabaseClient, userId: string, locale: string): Promise<ActivityItem[]> {
  const thread = "thread:agent_threads(customer_wa_id, customer_name)";
  const [{ data: approvals }, { data: events }, { data: connection }] = await Promise.all([
    supabase
      .from("agent_approvals")
      .select(`id, kind, request, created_at, booking:widget_bookings(service_name, starts_at, staff_name, location_id), ${thread}`)
      .eq("owner_user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("agent_activity")
      .select(`id, kind, summary, created_at, ${thread}`)
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("whatsapp_connections")
      .select("instance:widget_instances(config)")
      .eq("owner_user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
  ]);

  // Service/staff names for new-booking requests come from the booking config.
  const config = normalizeCalendarConfig((connection as { instance?: { config?: unknown } } | null)?.instance?.config);
  const scopeOf = (locationId?: string | null) => {
    const loc = locationId ? config.locations.find((l) => l.id === locationId) : undefined;
    return {
      services: loc ? loc.services : config.services,
      staff: loc ? loc.staff : config.staff,
      timezone: loc?.timezone || config.timezone,
      location: loc?.name,
    };
  };

  const pending: ActivityItem[] = ((approvals ?? []) as unknown as ApprovalRow[]).map((a) => {
    const locationId = a.request.location_id ?? a.booking?.location_id;
    const scope = scopeOf(locationId);
    const service =
      a.booking?.service_name ??
      (a.request.service_ids ?? []).map((id) => scope.services.find((s) => s.id === id)?.name ?? id).join(" + ");
    // null ⇒ any available staff (localized on the client).
    const staff = a.booking?.staff_name ?? scope.staff.find((s) => s.id === a.request.staff_id)?.name ?? null;
    const when =
      a.kind === "reschedule"
        ? `${fmt(a.booking?.starts_at, scope.timezone, locale)} → ${fmt(a.request.starts_at, scope.timezone, locale)}`
        : fmt(a.request.starts_at ?? a.booking?.starts_at, scope.timezone, locale);
    return {
      id: a.id,
      kind: "approval",
      ...who(a.thread),
      title: APPROVAL_TITLE[a.kind],
      detail: [service, when, scope.location].filter(Boolean).join(" · "),
      at: a.created_at,
      pending: { service, when, staff },
    };
  });

  const feed: ActivityItem[] = ((events ?? []) as unknown as EventRow[]).flatMap((e) => {
    const view = EVENT_VIEW[e.kind];
    if (!view) return [];
    return [{ id: e.id, kind: view.kind, ...who(e.thread), title: view.title, detail: e.summary, at: e.created_at }];
  });

  return [...pending, ...feed];
}
