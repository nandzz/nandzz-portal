// Multi-service / per-service-staff rendering: {{services}} rows, the singular/
// plural section flags, and the de-duplicated {{staff}} list.

import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { bookingMessageVars, type BookingMessageContext } from "../messages.ts";
import { bookingServiceLines, servicesHtml } from "../render.ts";
import type { BookingRow } from "../types.ts";

function row(overrides: Partial<BookingRow>): BookingRow {
  return {
    id: "b1",
    instance_id: "i1",
    owner_user_id: "o1",
    service_name: "Haircut",
    price_cents: null,
    staff_name: null,
    services: null,
    starts_at: "2026-10-06T09:00:00Z",
    customer_name: "Ana Silva",
    customer_email: "ana@example.com",
    customer_phone: null,
    manage_token: "tok",
    created_by_user_id: null,
    locale: "en",
    status: "confirmed",
    created_at: "2026-10-01T09:00:00Z",
    ...overrides,
  };
}

function ctx(booking: BookingRow): BookingMessageContext {
  return {
    customerName: booking.customer_name,
    businessName: "Biz",
    serviceName: booking.service_name,
    staffName: booking.staff_name,
    services: bookingServiceLines(booking),
    startsAt: booking.starts_at,
    timezone: "UTC",
    priceCents: null,
    currencySymbol: "€",
    manageUrl: "https://x/booking/tok",
  };
}

Deno.test("single-service booking is one line using the parent staff", () => {
  const b = row({ staff_name: "Marco" });
  assertEquals(bookingServiceLines(b), [{ name: "Haircut", staffName: "Marco" }]);
  const vars = bookingMessageVars(ctx(b), "en");
  assertEquals(vars.single_service, "1");
  assertEquals(vars.multi_service, "");
  assertEquals(vars.staff, "Marco");
});

Deno.test("per-service staff: each service keeps its own staff", () => {
  const b = row({
    service_name: "Haircut + Colour",
    staff_name: "Ana",
    services: [
      { name: "Haircut", staff_name: "Ana" },
      { name: "Colour", staff_name: "Bea" },
      { name: "Wash", staff_name: "Ana" },
    ],
  });
  const vars = bookingMessageVars(ctx(b), "en");
  assertEquals(vars.multi_service, "1");
  assertEquals(vars.single_service, "");
  assertEquals(vars.staff, "Ana, Bea");
  assertEquals(vars.services, "Haircut (Ana), Colour (Bea), Wash (Ana)");
});

Deno.test("legacy multi-service snapshot without staff falls back to parent staff", () => {
  const b = row({ staff_name: "Marco", services: [{ name: "A" }, { name: "B" }] });
  assertEquals(bookingServiceLines(b).map((l) => l.staffName), ["Marco", "Marco"]);
});

Deno.test("services HTML escapes names and omits the staff line when unstaffed", () => {
  const html = servicesHtml([
    { name: "Cut & <Style>", staffName: null },
    { name: "Colour", staffName: "Bea" },
  ]);
  assertStringIncludes(html, "Cut &amp; &lt;Style&gt;");
  assertStringIncludes(html, ">Bea<");
  assert(!html.includes("<Style>"));
  assertEquals((html.match(/<tr>/g) ?? []).length, 3);
});
