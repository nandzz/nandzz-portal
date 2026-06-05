import { assertEquals, assertMatch } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { twiml, REPLY } from "../replies.ts";

Deno.test("twiml: wraps message in TwiML Response/Message tags", async () => {
  const res  = twiml("Hello there");
  const body = await res.text();
  assertEquals(body, "<Response><Message>Hello there</Message></Response>");
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "text/xml");
});

Deno.test("REPLY.mediaSaved: singular for count 1", () => {
  assertMatch(REPLY.mediaSaved(1), /Your file has/);
});

Deno.test("REPLY.mediaSaved: plural for count > 1", () => {
  assertMatch(REPLY.mediaSaved(3), /3 files have/);
});

Deno.test("REPLY.partialErr: includes saved and failed counts", () => {
  const msg = REPLY.partialErr(2, 1);
  assertMatch(msg, /Saved 2/);
  assertMatch(msg, /1 couldn't/);
});

Deno.test("REPLY constants are non-empty strings", () => {
  assertEquals(typeof REPLY.notLinked,  "string");
  assertEquals(typeof REPLY.noUrl,      "string");
  assertEquals(typeof REPLY.linkSaved,  "string");
  assertEquals(typeof REPLY.error,      "string");
  assertEquals(REPLY.notLinked.length  > 0, true);
  assertEquals(REPLY.noUrl.length      > 0, true);
  assertEquals(REPLY.linkSaved.length  > 0, true);
  assertEquals(REPLY.error.length      > 0, true);
});
