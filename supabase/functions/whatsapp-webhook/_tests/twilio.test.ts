import { assertEquals, assertNotEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeTwilioSignature, verifyTwilioSignature } from "../twilio.ts";

const TOKEN   = "12345";
const URL_STR = "https://myapp.example.com/webhooks/whatsapp";

Deno.test("computeTwilioSignature: produces stable base64 HMAC-SHA1", async () => {
  const sig1 = await computeTwilioSignature(TOKEN, URL_STR, { Body: "hello", From: "whatsapp:+1" });
  const sig2 = await computeTwilioSignature(TOKEN, URL_STR, { Body: "hello", From: "whatsapp:+1" });
  assertEquals(sig1, sig2);
});

Deno.test("computeTwilioSignature: different tokens produce different signatures", async () => {
  const sig1 = await computeTwilioSignature("token-a", URL_STR, { Body: "hello" });
  const sig2 = await computeTwilioSignature("token-b", URL_STR, { Body: "hello" });
  assertNotEquals(sig1, sig2);
});

Deno.test("computeTwilioSignature: different params produce different signatures", async () => {
  const sig1 = await computeTwilioSignature(TOKEN, URL_STR, { Body: "hello" });
  const sig2 = await computeTwilioSignature(TOKEN, URL_STR, { Body: "world" });
  assertNotEquals(sig1, sig2);
});

Deno.test("computeTwilioSignature: param order does not matter (sorted)", async () => {
  const sig1 = await computeTwilioSignature(TOKEN, URL_STR, { A: "1", B: "2" });
  const sig2 = await computeTwilioSignature(TOKEN, URL_STR, { B: "2", A: "1" });
  assertEquals(sig1, sig2);
});

Deno.test("computeTwilioSignature: empty params uses only URL", async () => {
  const sig = await computeTwilioSignature(TOKEN, URL_STR, {});
  assertNotEquals(sig, "");
});

Deno.test("verifyTwilioSignature: returns true for matching signature", async () => {
  const params = { Body: "test", From: "whatsapp:+15551234567", NumMedia: "0" };
  const sig    = await computeTwilioSignature(TOKEN, URL_STR, params);
  const result = await verifyTwilioSignature(TOKEN, URL_STR, params, sig);
  assertEquals(result, true);
});

Deno.test("verifyTwilioSignature: returns false for wrong signature", async () => {
  const params = { Body: "test" };
  const result = await verifyTwilioSignature(TOKEN, URL_STR, params, "wrongsig");
  assertEquals(result, false);
});

Deno.test("verifyTwilioSignature: returns false for empty signature", async () => {
  const result = await verifyTwilioSignature(TOKEN, URL_STR, { Body: "hello" }, "");
  assertEquals(result, false);
});
