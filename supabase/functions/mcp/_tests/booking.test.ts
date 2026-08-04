import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { bookAppointment } from "../tools/book_appointment.ts";
import { listAvailability } from "../tools/list_availability.ts";
import { makeCtx } from "./fakes.ts";

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
