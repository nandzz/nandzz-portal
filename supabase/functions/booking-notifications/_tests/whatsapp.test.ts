import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

import { sanitizeParam, toWhatsAppAddress } from "../twilio.ts";
import {
  contentVariables,
  pickWhatsAppTemplate,
  reminderSkipReason,
  type WhatsAppTemplates,
} from "../whatsapp.ts";
import type { BookingRow } from "../types.ts";

Deno.test("toWhatsAppAddress — E.164, 00-prefix, junk", () => {
  assertEquals(toWhatsAppAddress("+39 333 123 4567"), "whatsapp:+393331234567");
  assertEquals(toWhatsAppAddress("0039 333 1234567"), "whatsapp:+393331234567");
  assertEquals(toWhatsAppAddress("123"), null);
  assertEquals(toWhatsAppAddress(null), null);
});

Deno.test("sanitizeParam — collapses whitespace, never empty", () => {
  assertEquals(sanitizeParam("a\nb\t c    d"), "a b c d");
  assertEquals(sanitizeParam("   "), "-");
});

Deno.test("contentVariables — maps numbered slots, ignores bad keys", () => {
  const out = contentVariables(
    { "1": "customer_first_name", "2": "date_time", "3": "unknown", x: "business" },
    { customer_first_name: "Ana", date_time: "Today at 3:00 PM" },
  );
  assertEquals(out, { "1": "Ana", "2": "Today at 3:00 PM", "3": "-" });
});

Deno.test("pickWhatsAppTemplate — locale then en fallback, skips blank sid", () => {
  const t: WhatsAppTemplates = {
    enabled: true,
    reminder: {
      en: { content_sid: "HXen", variables: {} },
      it: { content_sid: "  ", variables: {} },
      pt: { content_sid: "HXpt", variables: {} },
    },
  };
  assertEquals(pickWhatsAppTemplate(t, "pt")?.content_sid, "HXpt");
  assertEquals(pickWhatsAppTemplate(t, "it")?.locale, "en");
  assertEquals(pickWhatsAppTemplate({ enabled: true, reminder: {} }, "en"), null);
});

const now = new Date("2026-10-03T10:00:00Z");
function booking(over: Partial<BookingRow & { whatsapp_opt_in: boolean }> = {}) {
  return {
    status: "confirmed",
    whatsapp_opt_in: true,
    starts_at: "2026-10-03T13:30:00Z",
    created_at: "2026-10-01T09:00:00Z",
    ...over,
  } as BookingRow & { whatsapp_opt_in: boolean };
}

Deno.test("reminderSkipReason — gates", () => {
  assertEquals(reminderSkipReason(booking(), {}, now), null);
  assertEquals(reminderSkipReason(booking({ status: "cancelled" }), {}, now), "not_confirmed");
  assertEquals(reminderSkipReason(booking({ whatsapp_opt_in: false }), {}, now), "no_opt_in");
  assertEquals(reminderSkipReason(booking(), { whatsapp_reminder: false }, now), "business_disabled");
  assertEquals(
    reminderSkipReason(booking({ created_at: "2026-10-03T09:00:00Z" }), {}, now),
    "booked_too_late",
  );
  assertEquals(
    reminderSkipReason(booking({ starts_at: "2026-10-03T09:00:00Z" }), {}, now),
    "already_started",
  );
});
