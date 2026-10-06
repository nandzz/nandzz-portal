import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCalendarConfig } from "@/features/booking/domain/calendar";
import { currencySymbol } from "@/features/booking/domain/messages";
import type { WidgetBooking } from "@/lib/types";

// Booker-side bookings are read through the service-role client (RLS on
// widget_bookings only exposes rows to the OWNER), so every fetch here MUST be
// scoped to created_by_user_id = the requesting user. Shared by the page's
// first render and the /api/bookings load-more route so both stay in sync.

const BOOKINGS_PAGE_SIZE = 12;

export type BookingFilter = "upcoming" | "past" | "cancelled";

// A booking the current user made, enriched with the business it's at (owner
// profile) and the instance's currency/timezone for display.
export type BookerBooking = WidgetBooking & {
  business: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  currencySymbol: string;
  timezone: string; // IANA tz the booking should be rendered in
};

type AdminClient = ReturnType<typeof createAdminClient>;

type OwnerRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type InstanceRow = {
  id: string;
  config: Record<string, unknown> | null;
};

export function normalizeFilter(value: string | null | undefined): BookingFilter {
  return value === "past" || value === "cancelled" ? value : "upcoming";
}

// True when the user has ever made a booking — drives the global empty state
// independently of the currently selected filter's page.
export async function hasAnyBookerBookings(admin: AdminClient, userId: string): Promise<boolean> {
  const { count } = await admin
    .from("widget_bookings")
    .select("id", { count: "exact", head: true })
    .eq("created_by_user_id", userId);
  return (count ?? 0) > 0;
}

// One page of the user's bookings for a single filter bucket. `now` is the
// caller-supplied request anchor so the upcoming/past boundary stays stable
// across load-more requests within a session.
export async function fetchBookerBookings(
  admin: AdminClient,
  userId: string,
  filter: BookingFilter,
  now: number,
  offset: number
): Promise<{ bookings: BookerBooking[]; hasMore: boolean }> {
  const nowIso = new Date(now).toISOString();

  let query = admin.from("widget_bookings").select("*").eq("created_by_user_id", userId);

  if (filter === "cancelled") {
    query = query.eq("status", "cancelled").order("starts_at", { ascending: false });
  } else if (filter === "upcoming") {
    // Soonest first — the next appointment is the one the user cares about.
    query = query.eq("status", "confirmed").gte("starts_at", nowIso).order("starts_at", { ascending: true });
  } else {
    query = query.eq("status", "confirmed").lt("starts_at", nowIso).order("starts_at", { ascending: false });
  }

  const { data: bookingRows } = await query.range(offset, offset + BOOKINGS_PAGE_SIZE - 1);
  const rows = (bookingRows ?? []) as WidgetBooking[];
  const hasMore = rows.length === BOOKINGS_PAGE_SIZE;

  // Enrich with the business (owner profile) and the instance's currency +
  // timezone. Batched .in(...) lookups keep this to two queries per page.
  const ownerIds = [...new Set(rows.map((b) => b.owner_user_id))];
  const instanceIds = [...new Set(rows.map((b) => b.instance_id))];

  const [ownersRes, instancesRes] = await Promise.all([
    ownerIds.length
      ? admin.from("profiles").select("id, username, display_name, avatar_url").in("id", ownerIds)
      : Promise.resolve({ data: [] as OwnerRow[] }),
    instanceIds.length
      ? admin
          .from("widget_instances")
          .select("id, config")
          .in("id", instanceIds)
      : Promise.resolve({ data: [] as InstanceRow[] }),
  ]);

  const owners = (ownersRes.data ?? []) as OwnerRow[];
  const instances = (instancesRes.data ?? []) as InstanceRow[];
  const ownerMap = new Map(owners.map((o) => [o.id, o]));
  const instanceMap = new Map(instances.map((i) => [i.id, i]));

  const bookings: BookerBooking[] = rows.map((b) => {
    const owner = ownerMap.get(b.owner_user_id);
    const instance = instanceMap.get(b.instance_id);
    // Currency lives on the calendar config (owner-selected), not the catalog.
    const config = normalizeCalendarConfig(instance?.config);
    return {
      ...b,
      business: owner
        ? {
            username: owner.username ?? null,
            display_name: owner.display_name ?? null,
            avatar_url: owner.avatar_url ?? null,
          }
        : null,
      currencySymbol: currencySymbol(config.currency),
      timezone: config.timezone,
    };
  });

  return { bookings, hasMore };
}
