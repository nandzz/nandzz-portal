// Pure calendar-widget logic: config defaults, validation, and availability/slot
// computation. No I/O, no server-only imports — safe to use from client
// components, route handlers, and tests alike. (The Supabase Edge Functions run
// on Deno and keep their own copy of the slot math.)

import type {
  AvailabilityWindows,
  CalendarConfig,
  CalendarService,
  StaffMember,
  WeekdayKey,
} from "@/lib/types";
import {
  defaultCalendarMessages,
  normalizeCalendarMessages,
  validateMessageTemplate,
} from "@/lib/widgets/messages";

export const WEEKDAYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export function defaultCalendarConfig(): CalendarConfig {
  return {
    timezone:
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        : "UTC",
    buffer_min: 0,
    show_prices: true,
    services: [],
    availability: {
      mon: [["09:00", "17:00"]],
      tue: [["09:00", "17:00"]],
      wed: [["09:00", "17:00"]],
      thu: [["09:00", "17:00"]],
      fri: [["09:00", "17:00"]],
    },
    blackout_dates: [],
    staff: [],
    messages: defaultCalendarMessages(),
  };
}

// Fill any missing keys on a raw staff member so downstream code can trust the
// shape. Returns null for entries without a usable id (dropped on normalize).
function normalizeStaffMember(raw: unknown): StaffMember | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<StaffMember>;
  if (typeof s.id !== "string" || !s.id) return null;
  return {
    id: s.id,
    name: typeof s.name === "string" ? s.name : "",
    photo_url: typeof s.photo_url === "string" ? s.photo_url : undefined,
    info: typeof s.info === "string" ? s.info : undefined,
    availability:
      s.availability && typeof s.availability === "object"
        ? (s.availability as AvailabilityWindows)
        : {},
    blackout_dates: Array.isArray(s.blackout_dates) ? s.blackout_dates : undefined,
  };
}

// Fill any missing keys so downstream code can trust the shape.
export function normalizeCalendarConfig(raw: unknown): CalendarConfig {
  const base = defaultCalendarConfig();
  if (!raw || typeof raw !== "object") return base;
  const c = raw as Partial<CalendarConfig>;
  return {
    timezone: typeof c.timezone === "string" && c.timezone ? c.timezone : base.timezone,
    buffer_min: Number.isFinite(c.buffer_min) ? Number(c.buffer_min) : 0,
    show_prices: typeof c.show_prices === "boolean" ? c.show_prices : true,
    services: Array.isArray(c.services) ? c.services : [],
    availability: (c.availability && typeof c.availability === "object" ? c.availability : {}) as CalendarConfig["availability"],
    blackout_dates: Array.isArray(c.blackout_dates) ? c.blackout_dates : [],
    staff: Array.isArray(c.staff)
      ? (c.staff.map(normalizeStaffMember).filter(Boolean) as StaffMember[])
      : [],
    messages: normalizeCalendarMessages(c.messages),
  };
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Validate a set of weekly [start,end] windows (business-wide or per-staff).
function validateAvailabilityWindows(windows: AvailabilityWindows, label: string): string[] {
  const errors: string[] = [];
  for (const day of WEEKDAYS) {
    const dayWindows = windows[day];
    if (!dayWindows) continue;
    for (const [start, end] of dayWindows) {
      if (!TIME_RE.test(start) || !TIME_RE.test(end))
        errors.push(`${label}: invalid time in ${WEEKDAY_LABELS[day]} (${start}–${end}).`);
      else if (minutesOf(start) >= minutesOf(end))
        errors.push(`${label}: ${WEEKDAY_LABELS[day]} start must be before end (${start}–${end}).`);
    }
  }
  return errors;
}

// Validate an owner-supplied config. Returns a list of human-readable errors
// (empty ⇒ valid). Used by the instance CRUD route before persisting.
export function validateCalendarConfig(config: CalendarConfig): string[] {
  const errors: string[] = [];
  if (!config.timezone) errors.push("Timezone is required.");
  if (config.buffer_min < 0) errors.push("Buffer cannot be negative.");

  const staffIds = new Set((config.staff ?? []).map((s) => s.id));

  const ids = new Set<string>();
  for (const s of config.services) {
    if (!s.id) errors.push(`Service "${s.name || "?"}" is missing an id.`);
    if (ids.has(s.id)) errors.push(`Duplicate service id "${s.id}".`);
    ids.add(s.id);
    if (!s.name?.trim()) errors.push("Every service needs a name.");
    if (!Number.isFinite(s.duration_min) || s.duration_min <= 0)
      errors.push(`Service "${s.name}" needs a positive duration.`);
    for (const sid of s.staff_ids ?? []) {
      if (!staffIds.has(sid))
        errors.push(`Service "${s.name}" references an unknown staff member.`);
    }
  }

  const seenStaff = new Set<string>();
  for (const st of config.staff ?? []) {
    if (!st.id) errors.push(`Staff "${st.name || "?"}" is missing an id.`);
    if (seenStaff.has(st.id)) errors.push(`Duplicate staff id "${st.id}".`);
    seenStaff.add(st.id);
    if (!st.name?.trim()) errors.push("Every staff member needs a name.");
    errors.push(...validateAvailabilityWindows(st.availability, `Staff "${st.name || "?"}"`));
    for (const d of st.blackout_dates ?? []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d))
        errors.push(`Invalid day off "${d}" for staff "${st.name}".`);
    }
  }

  errors.push(...validateAvailabilityWindows(config.availability, "Availability"));

  for (const d of config.blackout_dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.push(`Invalid blackout date "${d}".`);
  }

  errors.push(...validateMessageTemplate(config.messages.confirmation, "Confirmation message"));
  errors.push(...validateMessageTemplate(config.messages.cancellation, "Cancellation message"));

  return errors;
}

// Weekday key for a "YYYY-MM-DD" calendar date (tz-independent — a date's
// weekday is the same everywhere). Anchored at noon UTC to dodge DST edges.
function weekdayOf(dateStr: string): WeekdayKey {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); // 0=Sun..6=Sat
  return WEEKDAYS[(dow + 6) % 7]; // shift so Mon=0
}

// Convert a wall-clock time in `timeZone` to the corresponding UTC instant.
// Standard offset trick; accurate except within the ~1h DST transition window,
// which is acceptable for v1 booking granularity.
export function zonedWallTimeToUtc(dateStr: string, hhmm: string, timeZone: string): Date {
  const iso = `${dateStr}T${hhmm}:00`;
  const asUtc = new Date(`${iso}Z`);
  const tzView = new Date(asUtc.toLocaleString("en-US", { timeZone }));
  const utcView = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const offset = utcView.getTime() - tzView.getTime();
  return new Date(asUtc.getTime() + offset);
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12));
  return dt.toISOString().slice(0, 10);
}

// Today's calendar date in a given timezone as "YYYY-MM-DD".
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// A bookable slot. `staff_ids` lists the staff members free at this slot; it is
// present only when the instance has staff configured (undefined ⇒ the business
// is a single resource and staff selection doesn't apply).
export type Slot = { start: string; end: string; staff_ids?: string[] };

export type ComputeSlotsInput = {
  config: CalendarConfig;
  service: CalendarService;
  fromDate: string; // owner-local "YYYY-MM-DD"
  days: number; // window length (inclusive of fromDate)
  existingBookings: { starts_at: string; ends_at: string; staff_id?: string | null }[];
  now?: Date;
  minLeadMinutes?: number; // don't offer slots sooner than this from now
  staffId?: string | null; // restrict to a single staff member (reschedule / filtered availability)
};

// Staff members eligible to perform a service. A service with no `staff_ids`
// (or an empty list) is performable by everyone; otherwise only the listed
// staff. With no staff configured at all, returns [] (single-resource mode).
export function eligibleStaffForService(
  config: CalendarConfig,
  service: CalendarService
): StaffMember[] {
  const staff = config.staff ?? [];
  if (staff.length === 0) return [];
  const ids = service.staff_ids;
  if (!ids || ids.length === 0) return staff;
  const set = new Set(ids);
  return staff.filter((s) => set.has(s.id));
}

// Whether a staff member is working a slot [startMin, endMin) (owner-local
// minutes) on a given weekday and not on a personal day off.
function staffWorksSlot(
  staff: StaffMember,
  weekday: WeekdayKey,
  dateStr: string,
  startMin: number,
  endMin: number
): boolean {
  if (staff.blackout_dates?.includes(dateStr)) return false;
  const windows = staff.availability[weekday] ?? [];
  return windows.some(([s, e]) => minutesOf(s) <= startMin && endMin <= minutesOf(e));
}

// Generate the open slots for a service across a date range. A slot is offered
// when it fits fully inside a day's availability window, isn't on a blackout
// date, is far enough in the future, and doesn't overlap an existing confirmed
// booking (respecting the configured buffer).
//
// When the instance has staff, a slot is open if at least one eligible staff
// member both works that window and has no clashing booking of their own; the
// surviving staff ids ride along on each slot. Booking clashes are matched per
// staff, so two customers can hold the same time with different staff.
export function computeAvailableSlots(input: ComputeSlotsInput): Slot[] {
  const { config, service, fromDate, days, existingBookings } = input;
  const now = input.now ?? new Date();
  const minLead = input.minLeadMinutes ?? 0;
  const buffer = Math.max(0, config.buffer_min || 0);
  const step = service.duration_min + buffer;
  const earliest = now.getTime() + minLead * 60_000;
  const pad = buffer * 60_000;

  const eligible = eligibleStaffForService(config, service);
  const staffMode = eligible.length > 0;
  const restrict = input.staffId ? input.staffId : null;

  const busy = existingBookings.map((b) => ({
    start: new Date(b.starts_at).getTime(),
    end: new Date(b.ends_at).getTime(),
    staffId: b.staff_id ?? null,
  }));

  const slots: Slot[] = [];

  for (let i = 0; i < days; i++) {
    const dateStr = addDays(fromDate, i);
    if (config.blackout_dates.includes(dateStr)) continue;

    const weekday = weekdayOf(dateStr);
    const windows = config.availability[weekday] ?? [];
    for (const [winStart, winEnd] of windows) {
      const winStartMin = minutesOf(winStart);
      const winEndMin = minutesOf(winEnd);

      for (let m = winStartMin; m + service.duration_min <= winEndMin; m += step) {
        const endMin = m + service.duration_min;
        const hh = String(Math.floor(m / 60)).padStart(2, "0");
        const mm = String(m % 60).padStart(2, "0");
        const startUtc = zonedWallTimeToUtc(dateStr, `${hh}:${mm}`, config.timezone);
        const startMs = startUtc.getTime();
        const endMs = startMs + service.duration_min * 60_000;

        if (startMs < earliest) continue;

        if (!staffMode) {
          // Single-resource: overlap against every existing booking.
          const clash = busy.some((b) => startMs < b.end + pad && endMs + pad > b.start);
          if (clash) continue;
          slots.push({
            start: new Date(startMs).toISOString(),
            end: new Date(endMs).toISOString(),
          });
          continue;
        }

        // Staffed: collect the eligible staff free at this slot.
        const freeStaff: string[] = [];
        for (const st of eligible) {
          if (restrict && st.id !== restrict) continue;
          if (!staffWorksSlot(st, weekday, dateStr, m, endMin)) continue;
          const clash = busy.some(
            (b) => b.staffId === st.id && startMs < b.end + pad && endMs + pad > b.start
          );
          if (clash) continue;
          freeStaff.push(st.id);
        }
        if (freeStaff.length === 0) continue;
        slots.push({
          start: new Date(startMs).toISOString(),
          end: new Date(endMs).toISOString(),
          staff_ids: freeStaff,
        });
      }
    }
  }

  return slots;
}
