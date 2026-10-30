import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

import { bookingTimezone } from "../types.ts";

const config = {
  timezone: "UTC",
  locations: [
    { id: "loc_rome", timezone: "Europe/Rome" },
    { id: "loc_inherit" },
  ],
};

Deno.test("bookingTimezone — the booking's location timezone wins", () => {
  assertEquals(bookingTimezone(config, { location_id: "loc_rome" }), "Europe/Rome");
});

Deno.test("bookingTimezone — falls back to the business timezone", () => {
  assertEquals(bookingTimezone(config, { location_id: "loc_inherit" }), "UTC");
  assertEquals(bookingTimezone(config, { location_id: "loc_gone" }), "UTC");
  assertEquals(bookingTimezone(config, { location_id: null }), "UTC");
  assertEquals(bookingTimezone({ timezone: "Europe/Rome" }, {}), "Europe/Rome");
});

Deno.test("bookingTimezone — UTC when nothing is set", () => {
  assertEquals(bookingTimezone({}, { location_id: null }), "UTC");
});
