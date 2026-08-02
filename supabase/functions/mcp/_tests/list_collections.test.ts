import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { listCollections } from "../tools/list_collections.ts";
import { makeCtx } from "./fakes.ts";

Deno.test("list_collections: returns caller's rows and structured content", async () => {
  const rows = [
    { id: "c1", name: "Cool", is_default: true },
    { id: "c2", name: "Meh", is_default: false },
  ];
  const { ctx, fromCalls } = makeCtx({
    from: { collections: { select: { data: rows, error: null } } },
  });

  const res = await listCollections({}, ctx);

  assertEquals(fromCalls[0].table, "collections");
  // Ownership scope comes from the eq filter — the RPC is called via
  // service role and RLS won't guard us.
  assertEquals(fromCalls[0].eq, [["user_id", "user-1"]]);
  assertEquals(res.structuredContent?.collections, rows);
  assertStringIncludes(res.content[0].text, "Found 2");
});

Deno.test("list_collections: empty result surfaces a helpful hint", async () => {
  const { ctx } = makeCtx({
    from: { collections: { select: { data: [], error: null } } },
  });
  const res = await listCollections({}, ctx);
  assertEquals(res.structuredContent?.collections, []);
  assertStringIncludes(res.content[0].text, "no collections");
});

Deno.test("list_collections: DB errors return isError:true, not a throw", async () => {
  const { ctx } = makeCtx({
    from: { collections: { select: { data: null, error: { message: "boom" } } } },
  });
  const res = await listCollections({}, ctx);
  assert(res.isError, "expected isError to be set on failure");
  assertStringIncludes(res.content[0].text, "boom");
});
