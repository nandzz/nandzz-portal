import { assertEquals, assertNotEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { normalizePhone, extractUrl, todayDateString } from "../helpers.ts";

Deno.test("normalizePhone: strips whatsapp prefix and leading plus", () => {
  assertEquals(normalizePhone("whatsapp:+15551234567"), "15551234567");
  assertEquals(normalizePhone("whatsapp:15551234567"), "15551234567");
  assertEquals(normalizePhone("+15551234567"), "15551234567");
  assertEquals(normalizePhone("15551234567"), "15551234567");
});

Deno.test("normalizePhone: case-insensitive prefix strip", () => {
  assertEquals(normalizePhone("WhatsApp:+5511999990000"), "5511999990000");
  assertEquals(normalizePhone("WHATSAPP:+5511999990000"), "5511999990000");
});

Deno.test("extractUrl: returns first https URL from text", () => {
  assertEquals(extractUrl("check this https://example.com/path"), "https://example.com/path");
});

Deno.test("extractUrl: returns first http URL from text", () => {
  assertEquals(extractUrl("go to http://example.com and enjoy"), "http://example.com");
});

Deno.test("extractUrl: returns null when no URL present", () => {
  assertEquals(extractUrl("hey how are you"), null);
  assertEquals(extractUrl(""), null);
});

Deno.test("extractUrl: ignores non-http protocols", () => {
  assertEquals(extractUrl("ftp://example.com"), null);
  assertEquals(extractUrl("just some text ftp://example.com more"), null);
});

Deno.test("todayDateString: returns a non-empty string", () => {
  const result = todayDateString();
  assertNotEquals(result, "");
});

Deno.test("todayDateString: matches en-US long-date format", () => {
  const result = todayDateString();
  // e.g. "June 5, 2026"
  assertEquals(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/.test(result), true);
});
