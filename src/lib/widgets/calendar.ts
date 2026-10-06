// Pure calendar-widget logic: config defaults, validation, and availability/slot
// computation. No I/O, no server-only imports — safe to use from client
// components, route handlers, and tests alike. (The Supabase Edge Functions run
// on Deno and keep their own copy of the slot math.)

import type {
  AvailabilityWindows,
  CalendarCategory,
  CalendarConfig,
  CalendarService,
  Location,
  StaffMember,
  WeekdayKey,
  WhatsAppReminderHours,
} from "@/lib/types";
import { WHATSAPP_REMINDER_HOURS } from "@/lib/types";
import {
  DEFAULT_WIDGET_CURRENCY,
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
    currency: DEFAULT_WIDGET_CURRENCY,
    buffer_min: 0,
    show_prices: true,
    collect_address: false,
    address_required: false,
    whatsapp_reminder: true,
    whatsapp_reminder_hours: 4,
    whatsapp_contact_phone: "",
    locations: [],
    services: [],
    categories: [],
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

// Fill any missing keys on a raw category so downstream code can trust the
// shape. Returns null for entries without a usable id (dropped on normalize).
function normalizeCategory(raw: unknown): CalendarCategory | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<CalendarCategory>;
  if (typeof c.id !== "string" || !c.id) return null;
  return { id: c.id, name: typeof c.name === "string" ? c.name : "" };
}

// Fill any missing keys on a raw location so downstream code can trust the
// shape, mirroring normalizeStaffMember. Returns null for entries without a
// usable id (dropped on normalize). Nested staff is normalized the same way
// as top-level staff; nested services follow the same (shallow) handling as
// top-level services below.
export function normalizeLocation(raw: unknown): Location | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Partial<Location>;
  if (typeof l.id !== "string" || !l.id) return null;
  return {
    id: l.id,
    name: typeof l.name === "string" ? l.name : "",
    address: typeof l.address === "string" ? l.address : undefined,
    photo_url: typeof l.photo_url === "string" ? l.photo_url : undefined,
    timezone: typeof l.timezone === "string" && l.timezone ? l.timezone : undefined,
    services: Array.isArray(l.services) ? (l.services as CalendarService[]) : [],
    categories: Array.isArray(l.categories)
      ? (l.categories.map(normalizeCategory).filter(Boolean) as CalendarCategory[])
      : [],
    staff: Array.isArray(l.staff)
      ? (l.staff.map(normalizeStaffMember).filter(Boolean) as StaffMember[])
      : [],
    availability:
      l.availability && typeof l.availability === "object"
        ? (l.availability as AvailabilityWindows)
        : {},
    blackout_dates: Array.isArray(l.blackout_dates) ? l.blackout_dates : undefined,
  };
}

// Fill any missing keys so downstream code can trust the shape.
export function normalizeCalendarConfig(raw: unknown): CalendarConfig {
  const base = defaultCalendarConfig();
  if (!raw || typeof raw !== "object") return base;
  const c = raw as Partial<CalendarConfig>;
  return {
    timezone: typeof c.timezone === "string" && c.timezone ? c.timezone : base.timezone,
    currency: typeof c.currency === "string" && c.currency ? c.currency.toLowerCase() : base.currency,
    buffer_min: Number.isFinite(c.buffer_min) ? Number(c.buffer_min) : 0,
    show_prices: typeof c.show_prices === "boolean" ? c.show_prices : true,
    collect_address: typeof c.collect_address === "boolean" ? c.collect_address : false,
    address_required: typeof c.address_required === "boolean" ? c.address_required : false,
    whatsapp_reminder: typeof c.whatsapp_reminder === "boolean" ? c.whatsapp_reminder : true,
    whatsapp_reminder_hours: (WHATSAPP_REMINDER_HOURS as readonly number[]).includes(
      Number(c.whatsapp_reminder_hours),
    )
      ? (Number(c.whatsapp_reminder_hours) as WhatsAppReminderHours)
      : 4,
    whatsapp_contact_phone: typeof c.whatsapp_contact_phone === "string" ? c.whatsapp_contact_phone.trim() : "",
    locations: Array.isArray(c.locations)
      ? (c.locations.map(normalizeLocation).filter(Boolean) as Location[])
      : [],
    services: Array.isArray(c.services) ? c.services : [],
    categories: Array.isArray(c.categories)
      ? (c.categories.map(normalizeCategory).filter(Boolean) as CalendarCategory[])
      : [],
    availability: (c.availability && typeof c.availability === "object" ? c.availability : {}) as CalendarConfig["availability"],
    blackout_dates: Array.isArray(c.blackout_dates) ? c.blackout_dates : [],
    staff: Array.isArray(c.staff)
      ? (c.staff.map(normalizeStaffMember).filter(Boolean) as StaffMember[])
      : [],
    messages: normalizeCalendarMessages(c.messages),
  };
}

// ── Location scope helpers (used by the Settings/Staff UI) ─────────────────
//
// Once an owner adds locations, the existing Services / Staff / Availability
// editors re-target from the top-level config to a single `config.locations[i]`
// subtree instead — these two helpers are the single place that knows how to
// read/write that subtree so the editors themselves stay unaware of whether
// they're pointed at the legacy top level or a location.
export type LocationScope = {
  services: CalendarService[];
  categories: CalendarCategory[];
  staff: StaffMember[];
  availability: AvailabilityWindows;
  blackout_dates: string[];
};

// `locationId` null/undefined ⇒ legacy top-level scope (unchanged behavior).
export function getLocationScope(config: CalendarConfig, locationId?: string | null): LocationScope {
  if (!locationId) {
    return {
      services: config.services,
      categories: config.categories ?? [],
      staff: config.staff,
      availability: config.availability,
      blackout_dates: config.blackout_dates,
    };
  }
  const loc = config.locations.find((l) => l.id === locationId);
  if (!loc) return { services: [], categories: [], staff: [], availability: {}, blackout_dates: [] };
  return {
    services: loc.services,
    categories: loc.categories ?? [],
    staff: loc.staff,
    availability: loc.availability,
    blackout_dates: loc.blackout_dates ?? [],
  };
}

// Applies a partial scope patch to `config`, writing into the top level when
// `locationId` is null/undefined, or into the matching `config.locations[i]`
// otherwise. Unknown location ids are a no-op (defensive against a location
// having been deleted elsewhere in the same edit session).
export function withLocationScope(
  config: CalendarConfig,
  locationId: string | null | undefined,
  patch: Partial<LocationScope>
): CalendarConfig {
  if (!locationId) return { ...config, ...patch };
  return {
    ...config,
    locations: config.locations.map((l) => (l.id === locationId ? { ...l, ...patch } : l)),
  };
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function minutesOf(hhmm: string): number {
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

// Validate a set of services against a known staff-id set. `label` prefixes
// every message (e.g. `Location "Downtown"`) — pass "" for the top-level call
// to keep its messages byte-for-byte identical to before this was extracted.
function validateServices(
  services: CalendarService[],
  staffIds: Set<string>,
  categoryIds: Set<string>,
  label: string
): string[] {
  const p = label ? `${label}: ` : "";
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const s of services) {
    if (!s.id) errors.push(`${p}Service "${s.name || "?"}" is missing an id.`);
    if (ids.has(s.id)) errors.push(`${p}Duplicate service id "${s.id}".`);
    ids.add(s.id);
    if (!s.name?.trim()) errors.push(`${p}Every service needs a name.`);
    if (!Number.isFinite(s.duration_min) || s.duration_min <= 0)
      errors.push(`${p}Service "${s.name}" needs a positive duration.`);
    for (const sid of s.staff_ids ?? []) {
      if (!staffIds.has(sid))
        errors.push(`${p}Service "${s.name}" references an unknown staff member.`);
    }
    if (s.category_id && !categoryIds.has(s.category_id))
      errors.push(`${p}Service "${s.name}" references an unknown category.`);
  }
  return errors;
}

// Validate a set of categories (id/name/uniqueness). Same `label` convention as
// validateServices. Returns the set of valid ids so services can be checked
// against it.
function validateCategories(categories: CalendarCategory[], label: string): string[] {
  const p = label ? `${label}: ` : "";
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const cat of categories) {
    if (!cat.id) errors.push(`${p}Category "${cat.name || "?"}" is missing an id.`);
    if (seen.has(cat.id)) errors.push(`${p}Duplicate category id "${cat.id}".`);
    seen.add(cat.id);
    if (!cat.name?.trim()) errors.push(`${p}Every category needs a name.`);
  }
  return errors;
}

// Validate a set of staff members (id/name/availability/days off). Same
// `label` convention as validateServices.
function validateStaff(staff: StaffMember[], label: string): string[] {
  const p = label ? `${label}: ` : "";
  const errors: string[] = [];
  const seenStaff = new Set<string>();
  for (const st of staff) {
    if (!st.id) errors.push(`${p}Staff "${st.name || "?"}" is missing an id.`);
    if (seenStaff.has(st.id)) errors.push(`${p}Duplicate staff id "${st.id}".`);
    seenStaff.add(st.id);
    if (!st.name?.trim()) errors.push(`${p}Every staff member needs a name.`);
    errors.push(...validateAvailabilityWindows(st.availability, `${p}Staff "${st.name || "?"}"`));
    for (const d of st.blackout_dates ?? []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d))
        errors.push(`${p}Invalid day off "${d}" for staff "${st.name}".`);
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
  const categoryIds = new Set((config.categories ?? []).map((c) => c.id));
  errors.push(...validateCategories(config.categories ?? [], ""));
  errors.push(...validateServices(config.services, staffIds, categoryIds, ""));
  errors.push(...validateStaff(config.staff ?? [], ""));

  errors.push(...validateAvailabilityWindows(config.availability, "Availability"));

  for (const d of config.blackout_dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.push(`Invalid blackout date "${d}".`);
  }

  // Locations: each is independently validated against its own nested
  // services/staff. Empty `locations` ⇒ nothing to do here (legacy mode).
  const seenLocationIds = new Set<string>();
  for (const loc of config.locations ?? []) {
    const label = `Location "${loc.name || loc.id || "?"}"`;
    if (!loc.id) errors.push(`${label} is missing an id.`);
    else if (seenLocationIds.has(loc.id)) errors.push(`Duplicate location id "${loc.id}".`);
    seenLocationIds.add(loc.id);
    if (!loc.name?.trim()) errors.push("Every location needs a name.");

    const locStaffIds = new Set((loc.staff ?? []).map((s) => s.id));
    const locCategoryIds = new Set((loc.categories ?? []).map((c) => c.id));
    errors.push(...validateCategories(loc.categories ?? [], label));
    errors.push(...validateServices(loc.services ?? [], locStaffIds, locCategoryIds, label));
    errors.push(...validateStaff(loc.staff ?? [], label));
    errors.push(...validateAvailabilityWindows(loc.availability ?? {}, `${label} availability`));
    for (const d of loc.blackout_dates ?? []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.push(`${label}: invalid blackout date "${d}".`);
    }
    if (loc.timezone !== undefined && !loc.timezone.trim())
      errors.push(`${label}: timezone cannot be empty when set.`);
  }

  errors.push(...validateMessageTemplate(config.messages.confirmation, "Confirmation message"));
  errors.push(...validateMessageTemplate(config.messages.cancellation, "Cancellation message"));
  errors.push(...validateMessageTemplate(config.messages.reschedule, "Reschedule message"));
  errors.push(...validateMessageTemplate(config.messages.reminder, "Reminder message"));

  return errors;
}

// Weekday key for a "YYYY-MM-DD" calendar date (tz-independent — a date's
// weekday is the same everywhere). Anchored at noon UTC to dodge DST edges.
export function weekdayOf(dateStr: string): WeekdayKey {
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

export function addDays(dateStr: string, n: number): string {
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
  // When set, slots are computed against this location's own timezone (falling
  // back to config.timezone when unset), availability, blackout_dates and
  // staff instead of the top-level config fields. Undefined ⇒ today's
  // byte-for-byte legacy behavior.
  location?: Location;
};

// Staff members eligible to perform a service, out of `staff` (a location's
// staff or the top-level config.staff). A service with no `staff_ids` (or an
// empty list) is performable by everyone; otherwise only the listed staff.
// With no staff at all, returns [] (single-resource mode).
export function eligibleStaffForService(
  staff: StaffMember[],
  service: CalendarService
): StaffMember[] {
  if (staff.length === 0) return [];
  const ids = service.staff_ids;
  if (!ids || ids.length === 0) return staff;
  const set = new Set(ids);
  return staff.filter((s) => set.has(s.id));
}

// Staff members eligible to perform EVERY service in `services` (the
// intersection of each service's eligible set). A service with no `staff_ids`
// doesn't restrict; a staff member survives only if no selected service
// excludes them. Empty `services` ⇒ behaves like the single-service helper on
// nothing (returns [] when no staff, else all staff).
export function eligibleStaffForServices(
  staff: StaffMember[],
  services: CalendarService[]
): StaffMember[] {
  if (staff.length === 0) return [];
  return staff.filter((s) =>
    services.every((svc) => {
      const ids = svc.staff_ids;
      if (!ids || ids.length === 0) return true; // service open to anyone
      return ids.includes(s.id);
    })
  );
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
  const { config, service, fromDate, days, existingBookings, location } = input;
  const now = input.now ?? new Date();
  const minLead = input.minLeadMinutes ?? 0;
  const buffer = Math.max(0, config.buffer_min || 0);
  const step = service.duration_min + buffer;
  const earliest = now.getTime() + minLead * 60_000;
  const pad = buffer * 60_000;

  // Location-scoped reads (tz/availability/blackout/staff) fall back to the
  // top-level config fields exactly as before when no location is given.
  const timezone = location?.timezone ?? config.timezone;
  const availability = location ? location.availability : config.availability;
  const blackoutDates = location ? location.blackout_dates ?? [] : config.blackout_dates;
  const staffSource = location ? location.staff : config.staff ?? [];

  const eligible = eligibleStaffForService(staffSource, service);
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
    if (blackoutDates.includes(dateStr)) continue;

    const weekday = weekdayOf(dateStr);
    const windows = availability[weekday] ?? [];
    for (const [winStart, winEnd] of windows) {
      const winStartMin = minutesOf(winStart);
      const winEndMin = minutesOf(winEnd);

      for (let m = winStartMin; m + service.duration_min <= winEndMin; m += step) {
        const endMin = m + service.duration_min;
        const hh = String(Math.floor(m / 60)).padStart(2, "0");
        const mm = String(m % 60).padStart(2, "0");
        const startUtc = zonedWallTimeToUtc(dateStr, `${hh}:${mm}`, timezone);
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

// ── Segmented (per-service staff) scheduling ────────────────────────────────
//
// A multi-service booking is scheduled as a set of SEGMENTS — one per selected
// service — each handled by its OWN staff member. Sequential services take
// back-to-back slices of the booking; services flagged `parallel` run
// concurrently (each still needs its own free staff, so overlapping segments
// must be assigned DISTINCT people). This replaces the old "one combined block,
// one staff eligible for everything" model, which blocked any booking whose
// services had no single common staff member.
//
// The functions below are pure: the availability route feeds them the busy
// ranges (read from widget_booking_segments), and the book/reschedule routes
// use `resolveSegmentPlan` to turn a chosen start into the concrete per-segment
// staff plan handed to the create/reschedule RPC.

// A service the visitor wants, paired with their per-service staff choice.
// `staffId` empty/undefined ⇒ "any available" (auto-assigned); a concrete id ⇒
// that specialist only. Ignored when the business has no staff at all.
export type ServiceChoice = { service: CalendarService; staffId?: string };

// One selected service laid out inside the booking: its order (`seq`), its
// offset from the booking start in minutes, and whether it runs concurrently.
export type PlannedSegment = {
  service: CalendarService;
  seq: number;
  offsetMin: number;
  parallel: boolean;
  staffId?: string;
};

// Lay the selected services out on the booking timeline. Sequential services
// stack back-to-back (in selection order); parallel services all start at the
// booking's start (offset 0) and thus overlap the sequential chain's beginning.
// A single-resource business (no staff) can't do two things at once, so
// `parallel` is ignored there — everything is sequential.
export function layoutServiceSegments(
  choices: ServiceChoice[],
  hasStaff: boolean
): { segments: PlannedSegment[]; totalMin: number } {
  let seqCursor = 0;
  let maxParallel = 0;
  const segments = choices.map((c, i) => {
    const dur = c.service.duration_min || 0;
    const parallel = hasStaff && !!c.service.parallel;
    let offsetMin: number;
    if (parallel) {
      offsetMin = 0;
      maxParallel = Math.max(maxParallel, dur);
    } else {
      offsetMin = seqCursor;
      seqCursor += dur;
    }
    return { service: c.service, seq: i, offsetMin, parallel, staffId: c.staffId };
  });
  return { segments, totalMin: Math.max(seqCursor, maxParallel) };
}

// Do two laid-out segments overlap in time (relative to the booking start)?
function segmentsOverlap(a: PlannedSegment, b: PlannedSegment): boolean {
  const aEnd = a.offsetMin + (a.service.duration_min || 0);
  const bEnd = b.offsetMin + (b.service.duration_min || 0);
  return a.offsetMin < bEnd && b.offsetMin < aEnd;
}

// The staff eligible AND allowed for a segment: the service's eligible staff,
// narrowed to the visitor's chosen specialist when they picked one. Empty when
// the picked specialist can't do the service (defensive) or none are eligible.
function allowedStaffForSegment(seg: PlannedSegment, staffSource: StaffMember[]): StaffMember[] {
  const eligible = eligibleStaffForService(staffSource, seg.service);
  if (!seg.staffId) return eligible;
  return eligible.filter((s) => s.id === seg.staffId);
}

type BusyRange = { staffId: string | null; start: number; end: number };

// Confirmed segments that could clash with a candidate booking. `staff_id` null
// ⇒ the single-resource / unstaffed bucket. Location scoping is applied by the
// caller's query (mirroring the legacy availability read), so only staff_id is
// matched here.
export type ExistingSegmentBusy = {
  staff_id: string | null;
  starts_at: string;
  ends_at: string;
};

// Can we pick one candidate staff per segment such that any two OVERLAPPING
// segments get different people (and the shared single-resource "null" bucket is
// likewise never double-used by overlapping segments)? Tiny N (a handful of
// services), so a plain backtracking search is more than fast enough.
function assignmentExists(candidates: (string | null)[][], overlaps: boolean[][]): boolean {
  const chosen: (string | null)[] = new Array(candidates.length).fill(undefined);
  const bt = (i: number): boolean => {
    if (i === candidates.length) return true;
    for (const c of candidates[i]) {
      let ok = true;
      for (let j = 0; j < i; j++) {
        if (overlaps[i][j] && chosen[j] === c) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      chosen[i] = c;
      if (bt(i + 1)) return true;
    }
    chosen[i] = undefined as unknown as string | null;
    return false;
  };
  return bt(0);
}

// Shared per-start core: for a booking starting at `startMs`, compute each
// segment's free-eligible staff and whether a full distinct-staff assignment
// exists. Returns the per-segment free candidate ids (ordered as `staffSource`)
// when feasible, or null when the start is unbookable (out of hours, blackout,
// too soon, or some segment has no free eligible staff / no valid assignment).
function feasibleAtStart(args: {
  segments: PlannedSegment[];
  totalMin: number;
  startMs: number;
  dateStr: string;
  weekday: WeekdayKey;
  winStartMin: number;
  winEndMin: number;
  startMin: number; // booking start, owner-local minutes
  hasStaff: boolean;
  staffSource: StaffMember[];
  busy: BusyRange[];
  padMs: number;
}): (string | null)[][] | null {
  const { segments, totalMin, startMs, dateStr, weekday, winStartMin, winEndMin, startMin, hasStaff, staffSource, busy, padMs } = args;

  // The whole booking must fit inside this single availability window.
  if (startMin < winStartMin || startMin + totalMin > winEndMin) return null;

  const perSegment: (string | null)[][] = [];
  for (const seg of segments) {
    const segStartMin = startMin + seg.offsetMin;
    const segEndMin = segStartMin + (seg.service.duration_min || 0);
    const segStartMs = startMs + seg.offsetMin * 60_000;
    const segEndMs = segStartMs + (seg.service.duration_min || 0) * 60_000;
    const clashes = (staffId: string | null) =>
      busy.some((b) => b.staffId === staffId && segStartMs < b.end + padMs && segEndMs + padMs > b.start);

    if (!hasStaff) {
      // Single-resource: the one (null) resource must be free for the segment.
      if (clashes(null)) return null;
      perSegment.push([null]);
      continue;
    }

    const allowed = allowedStaffForSegment(seg, staffSource);
    const free = allowed
      .filter((st) => staffWorksSlot(st, weekday, dateStr, segStartMin, segEndMin) && !clashes(st.id))
      .map((st) => st.id);
    if (free.length === 0) return null;
    perSegment.push(free);
  }

  const overlaps = segments.map((a, i) => segments.map((b, j) => i !== j && segmentsOverlap(a, b)));
  if (!assignmentExists(perSegment, overlaps)) return null;
  return perSegment;
}

export type SegmentedSlotsInput = {
  config: CalendarConfig;
  choices: ServiceChoice[];
  fromDate: string; // owner-local "YYYY-MM-DD"
  days: number;
  existingBusy: ExistingSegmentBusy[];
  now?: Date;
  minLeadMinutes?: number;
  location?: Location;
};

// Open whole-booking slots for a per-service-staffed multi-service selection.
// A slot is offered when the whole booking fits one availability window and a
// valid distinct-staff assignment exists across its segments given the current
// bookings. Returns the booking-level slots ({start,end}); the concrete
// per-segment staff is resolved at book time via `resolveSegmentPlan`.
export function computeSegmentedSlots(input: SegmentedSlotsInput): Slot[] {
  const { config, choices, fromDate, days, existingBusy, location } = input;
  if (choices.length === 0) return [];
  const now = input.now ?? new Date();
  const minLead = input.minLeadMinutes ?? 0;
  const buffer = Math.max(0, config.buffer_min || 0);
  const earliest = now.getTime() + minLead * 60_000;
  const padMs = buffer * 60_000;

  const timezone = location?.timezone ?? config.timezone;
  const availability = location ? location.availability : config.availability;
  const blackoutDates = location ? location.blackout_dates ?? [] : config.blackout_dates;
  const staffSource = location ? location.staff : config.staff ?? [];
  const hasStaff = staffSource.length > 0;

  const { segments, totalMin } = layoutServiceSegments(choices, hasStaff);
  if (totalMin <= 0) return [];
  const step = totalMin + buffer;

  const busy: BusyRange[] = existingBusy.map((b) => ({
    staffId: b.staff_id ?? null,
    start: new Date(b.starts_at).getTime(),
    end: new Date(b.ends_at).getTime(),
  }));

  const slots: Slot[] = [];
  for (let i = 0; i < days; i++) {
    const dateStr = addDays(fromDate, i);
    if (blackoutDates.includes(dateStr)) continue;
    const weekday = weekdayOf(dateStr);
    const windows = availability[weekday] ?? [];
    for (const [winStart, winEnd] of windows) {
      const winStartMin = minutesOf(winStart);
      const winEndMin = minutesOf(winEnd);
      for (let m = winStartMin; m + totalMin <= winEndMin; m += step) {
        const hh = String(Math.floor(m / 60)).padStart(2, "0");
        const mm = String(m % 60).padStart(2, "0");
        const startMs = zonedWallTimeToUtc(dateStr, `${hh}:${mm}`, timezone).getTime();
        if (startMs < earliest) continue;
        const feasible = feasibleAtStart({
          segments, totalMin, startMs, dateStr, weekday,
          winStartMin, winEndMin, startMin: m, hasStaff, staffSource, busy, padMs,
        });
        if (!feasible) continue;
        slots.push({
          start: new Date(startMs).toISOString(),
          end: new Date(startMs + totalMin * 60_000).toISOString(),
        });
      }
    }
  }
  return slots;
}

// The concrete per-segment plan for a booking, as handed to create_booking_tx /
// reschedule_booking_tx. `staff_ids` is the ORDERED candidate list for the
// segment (the resolved assignment first, then other free-eligible staff as
// race fallbacks); empty ⇒ an unstaffed/single-resource segment (staff null).
export type ResolvedSegment = {
  service_id: string;
  name: string;
  duration_min: number;
  price_cents: number | null;
  parallel: boolean;
  seq: number;
  offset_min: number;
  staff_ids: string[];
};

// Resolve a chosen booking start into its concrete segment plan, or a typed
// error reason when that start is unbookable. Used by the book + reschedule
// routes: the returned segments (with candidate staff per segment) go straight
// to the RPC, which inserts them transactionally under the exclusion
// constraint. Reasons mirror the create_booking_tx error codes.
export type SegmentPlanResult =
  | { ok: true; segments: ResolvedSegment[]; totalMin: number }
  | { ok: false; reason: "BLACKOUT" | "OUT_OF_HOURS" | "STAFF_UNAVAILABLE" };

export function resolveSegmentPlan(input: {
  config: CalendarConfig;
  choices: ServiceChoice[];
  startIso: string;
  existingBusy: ExistingSegmentBusy[];
  location?: Location;
}): SegmentPlanResult {
  const { config, choices, startIso, existingBusy, location } = input;
  const buffer = Math.max(0, config.buffer_min || 0);
  const padMs = buffer * 60_000;
  const timezone = location?.timezone ?? config.timezone;
  const availability = location ? location.availability : config.availability;
  const blackoutDates = location ? location.blackout_dates ?? [] : config.blackout_dates;
  const staffSource = location ? location.staff : config.staff ?? [];
  const hasStaff = staffSource.length > 0;

  const { segments, totalMin } = layoutServiceSegments(choices, hasStaff);
  const startMs = new Date(startIso).getTime();

  // Owner-local wall clock of the requested start, to test it against the day's
  // windows / blackout the same way computeSegmentedSlots generates them.
  const dateStr = todayInZone(timezone, new Date(startMs));
  if (blackoutDates.includes(dateStr)) return { ok: false, reason: "BLACKOUT" };
  const weekday = weekdayOf(dateStr);
  // Reconstruct the owner-local start-minute from the instant.
  const localMinutesFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [hh, mm] = localMinutesFmt.format(new Date(startMs)).split(":").map(Number);
  const startMin = hh * 60 + mm;

  const busy: BusyRange[] = existingBusy.map((b) => ({
    staffId: b.staff_id ?? null,
    start: new Date(b.starts_at).getTime(),
    end: new Date(b.ends_at).getTime(),
  }));

  // Find the availability window containing the whole booking.
  const windows = availability[weekday] ?? [];
  const win = windows.find(([s, e]) => startMin >= minutesOf(s) && startMin + totalMin <= minutesOf(e));
  if (!win) return { ok: false, reason: "OUT_OF_HOURS" };

  const perSegment = feasibleAtStart({
    segments, totalMin, startMs, dateStr, weekday,
    winStartMin: minutesOf(win[0]), winEndMin: minutesOf(win[1]),
    startMin, hasStaff, staffSource, busy, padMs,
  });
  if (!perSegment) return { ok: false, reason: "STAFF_UNAVAILABLE" };

  // Pick a concrete valid assignment (assigned-first ordering per segment) so
  // the RPC's greedy insert lands on it when there's no concurrent race.
  const overlaps = segments.map((a, i) => segments.map((b, j) => i !== j && segmentsOverlap(a, b)));
  const chosen = pickAssignment(perSegment, overlaps);
  if (!chosen) return { ok: false, reason: "STAFF_UNAVAILABLE" };

  const resolved: ResolvedSegment[] = segments.map((seg, i) => {
    const assigned = chosen[i];
    // Assigned first, then the segment's other free staff as fallbacks.
    const ordered = assigned === null ? [] : [assigned, ...perSegment[i].filter((id) => id !== assigned && id !== null)] as string[];
    return {
      service_id: seg.service.id,
      name: seg.service.name,
      duration_min: seg.service.duration_min || 0,
      price_cents: typeof seg.service.price_cents === "number" ? seg.service.price_cents : null,
      parallel: seg.parallel,
      seq: seg.seq,
      offset_min: seg.offsetMin,
      staff_ids: ordered,
    };
  });
  return { ok: true, segments: resolved, totalMin };
}

// ── Per-staff availability status (owner reassignment picker) ───────────────
//
// For a FIXED window (an existing booking's service segment), classify EVERY
// in-scope staff member: can they perform the service, are they working then,
// and are they free — or which existing booking are they busy with. Powers the
// owner's "Assign staff" dialog, which shows the full roster (not just eligible
// staff) with the reason each unavailable person can't take the slot. Pure: the
// route supplies the busy segments (carrying their own metadata) and maps
// `conflict_index` back to the clashing booking for display.
export type StaffWindowStatus = {
  staff_id: string;
  // Can perform the service (service.staff_ids allows them, or it's unrestricted).
  eligible: boolean;
  // Has a working window covering the slot on that weekday and isn't on a day off.
  working: boolean;
  // Index into the provided busy array of the segment clashing for this staff,
  // or null when they have no clashing booking.
  conflict_index: number | null;
  // Free to take the slot (no time clash). Eligibility/working are advisory —
  // the owner may override them, but a time clash is a hard block.
  assignable: boolean;
};

export function staffAvailabilityForWindow(input: {
  config: CalendarConfig;
  service: CalendarService;
  startIso: string;
  endIso: string;
  existingBusy: ExistingSegmentBusy[];
  location?: Location;
}): StaffWindowStatus[] {
  const { config, service, startIso, endIso, existingBusy, location } = input;
  const timezone = location?.timezone ?? config.timezone;
  const staffSource = location ? location.staff : config.staff ?? [];
  const buffer = Math.max(0, config.buffer_min || 0);
  const padMs = buffer * 60_000;
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  const dateStr = todayInZone(timezone, new Date(startMs));
  const weekday = weekdayOf(dateStr);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [sh, sm] = fmt.format(new Date(startMs)).split(":").map(Number);
  const startMin = sh * 60 + sm;
  // Derive the window length from the instants (robust across a midnight/local
  // boundary) rather than re-parsing the end wall-clock.
  const endMin = startMin + Math.round((endMs - startMs) / 60_000);

  const eligibleIds = new Set(eligibleStaffForService(staffSource, service).map((s) => s.id));

  return staffSource.map((st) => {
    const eligible = eligibleIds.has(st.id);
    const working = staffWorksSlot(st, weekday, dateStr, startMin, endMin);
    let conflict_index: number | null = null;
    for (let i = 0; i < existingBusy.length; i++) {
      const b = existingBusy[i];
      if ((b.staff_id ?? null) !== st.id) continue;
      const bs = new Date(b.starts_at).getTime();
      const be = new Date(b.ends_at).getTime();
      if (startMs < be + padMs && endMs + padMs > bs) {
        conflict_index = i;
        break;
      }
    }
    return { staff_id: st.id, eligible, working, conflict_index, assignable: conflict_index === null };
  });
}

// Like assignmentExists, but returns the actual chosen assignment (or null).
function pickAssignment(candidates: (string | null)[][], overlaps: boolean[][]): (string | null)[] | null {
  const chosen: (string | null)[] = new Array(candidates.length).fill(undefined);
  const bt = (i: number): boolean => {
    if (i === candidates.length) return true;
    for (const c of candidates[i]) {
      let ok = true;
      for (let j = 0; j < i; j++) {
        if (overlaps[i][j] && chosen[j] === c) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      chosen[i] = c;
      if (bt(i + 1)) return true;
    }
    chosen[i] = undefined as unknown as string | null;
    return false;
  };
  return bt(0) ? chosen : null;
}
