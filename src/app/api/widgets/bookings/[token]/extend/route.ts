import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSessionOwner } from "@/features/booking/data/session-owner";
import {
  minutesOf,
  normalizeCalendarConfig,
  timezoneForLocation,
  todayInZone,
  weekdayOf,
  zonedWallTimeToUtc,
} from "@/features/booking/domain/calendar";
import type { WidgetBooking } from "@/lib/types";

// Owner-only: push a booking's END out by N minutes (the client stayed longer).
// No hours / "already started" rules — only a clash with the next booking of
// the same staff (or location) blocks it (extend_booking_tx → SLOT_TAKEN).
// Silent: no customer email.
const EXTEND_MIN_MINUTES = 5;
const EXTEND_MAX_MINUTES = 480;
// How far past the booking's end the timeline looks for the next booking.
const LOOKAHEAD_MS = EXTEND_MAX_MINUTES * 60_000;

type Seg = { booking_id: string; staff_id: string | null; staff_name: string | null; starts_at: string; ends_at: string };

// Owner-only: the extend dialog's timeline. One lane per resource whose segment
// ends last (the one that would grow) — this booking's blocks, everyone else's
// bookings on that lane over the next 8h, the free room before the first clash
// (`max_minutes`) and the opening-hours close as a soft marker.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("widget_bookings")
    .select("id, instance_id, owner_user_id, status, starts_at, ends_at, location_id, instance:widget_instances(config)")
    .eq("manage_token", token)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!(await isSessionOwner(booking.owner_user_id as string))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: ownRows } = await admin
    .from("widget_booking_segments")
    .select("booking_id, staff_id, staff_name, starts_at, ends_at")
    .eq("booking_id", booking.id)
    .eq("status", "confirmed");
  const own = (ownRows ?? []) as Seg[];
  const lastEndMs = Math.max(...own.map((s) => Date.parse(s.ends_at)), Date.parse(booking.ends_at as string));
  const growing = own.filter((s) => Date.parse(s.ends_at) === lastEndMs);
  const laneKeys = [...new Set((growing.length > 0 ? growing : own).map((s) => s.staff_id))];

  const windowStart = booking.starts_at as string;
  const windowEnd = new Date(lastEndMs + LOOKAHEAD_MS).toISOString();
  let othersQuery = admin
    .from("widget_booking_segments")
    .select("booking_id, staff_id, staff_name, starts_at, ends_at")
    .eq("instance_id", booking.instance_id)
    .eq("status", "confirmed")
    .neq("booking_id", booking.id)
    .lt("starts_at", windowEnd)
    .gt("ends_at", windowStart);
  othersQuery = booking.location_id
    ? othersQuery.eq("location_id", booking.location_id)
    : othersQuery.is("location_id", null);
  const { data: otherRows } = await othersQuery;
  const others = ((otherRows ?? []) as Seg[]).filter((s) => laneKeys.includes(s.staff_id));

  const ids = [...new Set(others.map((s) => s.booking_id))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: rows } = await admin.from("widget_bookings").select("id, customer_name").in("id", ids);
    for (const r of rows ?? []) names.set(r.id as string, r.customer_name as string);
  }

  const lanes = laneKeys.map((key) => ({
    staff_id: key,
    staff_name: own.find((s) => s.staff_id === key)?.staff_name ?? null,
    own: own.filter((s) => s.staff_id === key).map(({ starts_at, ends_at }) => ({ starts_at, ends_at })),
    others: others
      .filter((s) => s.staff_id === key)
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
      .map((s) => ({ starts_at: s.starts_at, ends_at: s.ends_at, customer_name: names.get(s.booking_id) ?? "" })),
  }));

  // Free room = gap to the earliest booking that starts at/after the end, on
  // any lane that would grow (capped at the max a single extend allows).
  const nextStarts = lanes.flatMap((l) =>
    l.others.map((o) => Date.parse(o.starts_at)).filter((t) => t >= lastEndMs)
  );
  const maxMinutes = Math.min(
    EXTEND_MAX_MINUTES,
    nextStarts.length > 0 ? Math.floor((Math.min(...nextStarts) - lastEndMs) / 60_000) : EXTEND_MAX_MINUTES
  );

  // Soft marker: when the opening window holding the booking's start closes.
  const config = normalizeCalendarConfig((booking.instance as { config?: unknown } | null)?.config);
  const timezone = timezoneForLocation(config, booking.location_id as string | null);
  const location = booking.location_id ? config.locations.find((l) => l.id === booking.location_id) : undefined;
  const availability = location ? location.availability : config.availability;
  const startDate = new Date(booking.starts_at as string);
  const dateStr = todayInZone(timezone, startDate);
  const [hh, mm] = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false })
    .format(startDate)
    .split(":")
    .map(Number);
  const startMin = hh * 60 + mm;
  const win = (availability[weekdayOf(dateStr)] ?? []).find(
    ([s, e]) => startMin >= minutesOf(s) && startMin < minutesOf(e)
  );
  const closesAt = win ? zonedWallTimeToUtc(dateStr, win[1], timezone).toISOString() : null;

  return NextResponse.json({
    timezone,
    starts_at: booking.starts_at,
    ends_at: new Date(lastEndMs).toISOString(),
    max_minutes: maxMinutes,
    closes_at: closesAt,
    lanes,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { minutes } = (await req.json().catch(() => ({}))) as { minutes?: unknown };
  const mins = Number(minutes);
  if (!Number.isInteger(mins) || mins < EXTEND_MIN_MINUTES || mins > EXTEND_MAX_MINUTES) {
    return NextResponse.json({ error: "INVALID_DURATION" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("widget_bookings")
    .select("id, owner_user_id, status")
    .eq("manage_token", token)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!(await isSessionOwner(booking.owner_user_id as string))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (booking.status !== "confirmed") {
    return NextResponse.json({ error: "BOOKING_CANCELLED" }, { status: 409 });
  }

  const { data: row, error } = await admin
    .rpc("extend_booking_tx", { p_booking_id: booking.id, p_minutes: mins })
    .single<WidgetBooking>();
  if (error || !row) {
    const code = ["SLOT_TAKEN", "BOOKING_CANCELLED", "INVALID_DURATION"].find((c) => error?.message?.includes(c));
    if (!code) console.error("[bookings/extend] extend_booking_tx failed:", error);
    return NextResponse.json({ error: code ?? "GENERIC" }, { status: code ? 409 : 500 });
  }

  return NextResponse.json({ ok: true, ends_at: row.ends_at, duration_min: row.duration_min });
}
