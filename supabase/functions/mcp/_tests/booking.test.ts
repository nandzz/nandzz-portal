import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { bookAppointment } from "../tools/book_appointment.ts";
import { listAvailability } from "../tools/list_availability.ts";
import { makeCtx } from "./fakes.ts";
import { computeSlots, type CalScope, type CalStaff } from "../tools/_calendar.ts";

const CALENDAR_CONFIG = {
  timezone: "UTC",
  buffer_min: 0,
  services: [{ id: "svc_1", name: "Haircut", duration_min: 30 }],
  availability: {
    mon: [["09:00", "17:00"]],
    tue: [["09:00", "17:00"]],
    wed: [["09:00", "17:00"]],
    thu: [["09:00", "17:00"]],
    fri: [["09:00", "17:00"]],
    sat: [["09:00", "17:00"]],
    sun: [["09:00", "17:00"]],
  },
  blackout_dates: [],
};

function calendarInstances() {
  return {
    widget_instances: {
      select: {
        data: [{ id: "inst-1", enabled: true, config: CALENDAR_CONFIG, catalog: { slug: "calendar" } }],
        error: null,
      },
    },
  };
}

Deno.test("book_appointment: calls create_booking_tx for the owner's calendar", async () => {
  const bookingRow = {
    id: "bk-1",
    service_name: "Haircut",
    starts_at: "2026-08-10T14:00:00Z",
    ends_at: "2026-08-10T14:30:00Z",
    customer_name: "Ada",
  };
  const { ctx, rpcCalls } = makeCtx({
    from: calendarInstances(),
    rpc: { create_booking_tx: { data: bookingRow, error: null } },
  });

  const res = await bookAppointment(
    {
      service_id: "svc_1",
      starts_at: "2026-08-10T14:00:00Z",
      customer_name: "Ada",
      customer_email: "ada@example.com",
    },
    ctx,
  );

  assert(!res.isError);
  assertStringIncludes(res.content[0].text, "Booked");
  const call = rpcCalls.find((c) => c.name === "create_booking_tx");
  assert(call);
  assertEquals(call!.args?.p_instance_id, "inst-1");
  assertEquals(call!.args?.p_created_by, "user-1");
  assertEquals(call!.args?.p_service_id, "svc_1");
});

Deno.test("book_appointment: surfaces SLOT_TAKEN as a friendly error", async () => {
  const { ctx } = makeCtx({
    from: calendarInstances(),
    rpc: { create_booking_tx: { data: null, error: { message: "SLOT_TAKEN" } } },
  });

  const res = await bookAppointment(
    {
      service_id: "svc_1",
      starts_at: "2026-08-10T14:00:00Z",
      customer_name: "Ada",
      customer_email: "ada@example.com",
    },
    ctx,
  );

  assert(res.isError);
  assertStringIncludes(res.content[0].text, "already booked");
});

Deno.test("book_appointment: errors when the account has no calendar widget", async () => {
  const { ctx, rpcCalls } = makeCtx({
    from: { widget_instances: { select: { data: [], error: null } } },
  });

  const res = await bookAppointment(
    { service_id: "svc_1", starts_at: "x", customer_name: "Ada", customer_email: "a@b.co" },
    ctx,
  );

  assert(res.isError);
  assertEquals(rpcCalls.find((c) => c.name === "create_booking_tx"), undefined);
});

Deno.test("list_availability: resolves the service and returns structured slots", async () => {
  const { ctx } = makeCtx({
    from: {
      ...calendarInstances(),
      widget_bookings: { select: { data: [], error: null } },
    },
  });

  const res = await listAvailability({ service_id: "svc_1", days: 7 }, ctx);

  assert(!res.isError);
  const sc = res.structuredContent as { service: { id: string }; timezone: string; slots: unknown[] };
  assertEquals(sc.service.id, "svc_1");
  assertEquals(sc.timezone, "UTC");
  assert(Array.isArray(sc.slots));
});

Deno.test("list_availability: rejects an unknown service_id", async () => {
  const { ctx } = makeCtx({ from: calendarInstances() });
  const res = await listAvailability({ service_id: "nope" }, ctx);
  assert(res.isError);
  assertStringIncludes(res.content[0].text, "Unknown service_id");
});

// ── Location-scoped calendars (every config since 20261029120000) ────────────

const WEEKDAY_HOURS = {
  mon: [["09:00", "11:00"]],
  tue: [["09:00", "11:00"]],
  wed: [["09:00", "11:00"]],
  thu: [["09:00", "11:00"]],
  fri: [["09:00", "11:00"]],
  sat: [["09:00", "11:00"]],
  sun: [["09:00", "11:00"]],
};

const LOCATED_CONFIG = {
  timezone: "UTC",
  buffer_min: 0,
  services: [],
  availability: {},
  blackout_dates: [],
  locations: [
    {
      id: "loc_main",
      name: "Main",
      timezone: "Europe/Rome",
      services: [{ id: "svc_1", name: "Haircut", duration_min: 60 }],
      staff: [],
      availability: WEEKDAY_HOURS,
      blackout_dates: [],
    },
  ],
};

function locatedInstances(config: unknown = LOCATED_CONFIG) {
  return {
    widget_instances: {
      select: {
        data: [{ id: "inst-1", enabled: true, config, catalog: { slug: "calendar" } }],
        error: null,
      },
    },
  };
}

Deno.test("list_availability: finds a service inside a location and reads its segments", async () => {
  const { ctx, fromCalls } = makeCtx({
    from: { ...locatedInstances(), widget_booking_segments: { select: { data: [], error: null } } },
  });

  const res = await listAvailability({ service_id: "svc_1", days: 7 }, ctx);

  assert(!res.isError, res.content[0].text);
  const sc = res.structuredContent as { timezone: string; location: { id: string }; slots: unknown[] };
  assertEquals(sc.timezone, "Europe/Rome");
  assertEquals(sc.location.id, "loc_main");
  assert(sc.slots.length > 0);
  const seg = fromCalls.find((c) => c.table === "widget_booking_segments");
  assert(seg);
  assert(seg!.eq.some(([col, val]) => col === "location_id" && val === "loc_main"));
});

Deno.test("book_appointment: books into the service's location", async () => {
  const { ctx, rpcCalls } = makeCtx({
    from: locatedInstances(),
    rpc: {
      create_booking_tx: {
        data: { id: "bk-1", service_name: "Haircut", starts_at: "x", ends_at: "y", customer_name: "Ada" },
        error: null,
      },
    },
  });

  const res = await bookAppointment(
    { service_id: "svc_1", starts_at: "2026-08-10T08:00:00Z", customer_name: "Ada", customer_email: "a@b.co" },
    ctx,
  );

  assert(!res.isError, res.content[0].text);
  const call = rpcCalls.find((c) => c.name === "create_booking_tx");
  assertEquals(call!.args?.p_location_id, "loc_main");
  assertStringIncludes(res.content[0].text, "Europe/Rome");
});

Deno.test("book_appointment: asks for location_id when the service is at several locations", async () => {
  const second = { ...LOCATED_CONFIG.locations[0], id: "loc_two", name: "Two" };
  const config = { ...LOCATED_CONFIG, locations: [LOCATED_CONFIG.locations[0], second] };
  const { ctx, rpcCalls } = makeCtx({ from: locatedInstances(config) });

  const res = await bookAppointment(
    { service_id: "svc_1", starts_at: "2026-08-10T08:00:00Z", customer_name: "Ada", customer_email: "a@b.co" },
    ctx,
  );
  assert(res.isError);
  assertStringIncludes(res.content[0].text, "location_id");
  assertEquals(rpcCalls.length, 0);

  const ok = await bookAppointment(
    {
      service_id: "svc_1",
      location_id: "loc_two",
      starts_at: "2026-08-10T08:00:00Z",
      customer_name: "Ada",
      customer_email: "a@b.co",
    },
    ctx,
  );
  assertEquals(rpcCalls.find((c) => c.name === "create_booking_tx")?.args?.p_location_id, "loc_two");
  assert(ok);
});

// ── computeSlots: staff-aware, matches the portal's single-service rules ─────

const scope = (staff: CalStaff[]): CalScope => ({
  locationId: "loc_main",
  locationName: "Main",
  timezone: "UTC",
  services: [],
  staff,
  availability: { mon: [["09:00", "11:00"]] },
  blackout_dates: [],
});
const haircut = { id: "svc_1", name: "Haircut", duration_min: 60 };
// 2026-08-10 is a Monday.
const MONDAY = "2026-08-10";
const longAgo = new Date("2000-01-01T00:00:00Z");
const starts = (slots: { start: string }[]) => slots.map((s) => s.start.slice(11, 16));

Deno.test("computeSlots: single resource — any segment blocks the slot", () => {
  const busy = [{ staff_id: null, starts_at: `${MONDAY}T09:00:00Z`, ends_at: `${MONDAY}T10:00:00Z` }];
  assertEquals(starts(computeSlots(scope([]), 0, haircut, MONDAY, 1, busy, longAgo)), ["10:00"]);
});

Deno.test("computeSlots: staffed — a booking only blocks its own staff member", () => {
  const a = { id: "a", availability: { mon: [["09:00", "11:00"]] as [string, string][] } };
  const b = { id: "b", availability: { mon: [["09:00", "11:00"]] as [string, string][] } };
  const busyA = [{ staff_id: "a", starts_at: `${MONDAY}T09:00:00Z`, ends_at: `${MONDAY}T10:00:00Z` }];
  assertEquals(starts(computeSlots(scope([a, b]), 0, haircut, MONDAY, 1, busyA, longAgo)), ["09:00", "10:00"]);
  assertEquals(starts(computeSlots(scope([a]), 0, haircut, MONDAY, 1, busyA, longAgo)), ["10:00"]);
});

Deno.test("computeSlots: staffed — respects staff hours and service staff_ids", () => {
  const early = { id: "early", availability: { mon: [["09:00", "10:00"]] as [string, string][] } };
  const late = { id: "late", availability: { mon: [["10:00", "11:00"]] as [string, string][] } };
  const onlyLate = { ...haircut, staff_ids: ["late"] };
  assertEquals(starts(computeSlots(scope([early, late]), 0, haircut, MONDAY, 1, [], longAgo)), ["09:00", "10:00"]);
  assertEquals(starts(computeSlots(scope([early, late]), 0, onlyLate, MONDAY, 1, [], longAgo)), ["10:00"]);
});
