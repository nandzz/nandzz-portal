import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  attachToCollection,
  decodeBase64,
  publishSpace,
  requireStr,
  requireVisibility,
} from "../tools/_shared.ts";
import { makeCtx, publishOk } from "./fakes.ts";

Deno.test("requireStr: rejects empty and non-string", () => {
  assertEquals(requireStr("ok", "title"), "ok");
  const err1 = () => requireStr("", "title");
  const err2 = () => requireStr(undefined, "title");
  const err3 = () => requireStr(42, "title");
  for (const fn of [err1, err2, err3]) {
    try {
      fn();
      throw new Error("expected throw");
    } catch (e) {
      assertStringIncludes((e as Error).message, "title");
    }
  }
});

Deno.test("requireVisibility: only 'private' or 'public' pass", () => {
  assertEquals(requireVisibility("public"), "public");
  assertEquals(requireVisibility("private"), "private");
  for (const bad of [undefined, null, "", "PUBLIC", "unlisted", 1]) {
    try {
      requireVisibility(bad);
      throw new Error("expected throw");
    } catch (e) {
      assertStringIncludes((e as Error).message, "visibility");
    }
  }
});

Deno.test("decodeBase64: raw and data URI both round-trip", () => {
  const raw = "aGVsbG8=";                        // "hello"
  const uri = "data:text/plain;base64,aGVsbG8=";
  const a = new TextDecoder().decode(decodeBase64(raw));
  const b = new TextDecoder().decode(decodeBase64(uri));
  assertEquals(a, "hello");
  assertEquals(b, "hello");
});

Deno.test("decodeBase64: tolerates whitespace/newlines", () => {
  const wrapped = "aGVs\nbG8=";
  assertEquals(new TextDecoder().decode(decodeBase64(wrapped)), "hello");
});

// ─── The regression that motivated this whole test file ────────────────────
// Never pass `p_cost: null` to publish_space_tx — the DB does
// `int - NULL = NULL` and then the UPDATE trips profiles.paid_credits NOT NULL.
// Omit the key so the SQL DEFAULT (or app_settings lookup) applies.
Deno.test("publishSpace: does NOT pass p_cost in the RPC args", async () => {
  const { ctx, rpcCalls } = makeCtx({
    rpc: { publish_space_tx: publishOk("space-xyz", 100, 5) },
  });

  const res = await publishSpace(ctx, { title: "t", is_public: true });

  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].name, "publish_space_tx");
  const args = rpcCalls[0].args!;
  assert(
    !("p_cost" in args),
    `p_cost must be omitted so DB default applies, got: ${JSON.stringify(args)}`,
  );
  assertEquals(args.p_user_id, "user-1");
  assertEquals(args.p_space_payload, { title: "t", is_public: true });
  assert(typeof args.p_client_request_id === "string");

  assertEquals(res.spaceId, "space-xyz");
  assertEquals(res.freeCredits, 100);
  assertEquals(res.paidCredits, 5);
});

Deno.test("publishSpace: surfaces INSUFFICIENT_CREDITS as a friendly message", async () => {
  const { ctx } = makeCtx({
    rpc: { publish_space_tx: { error: { message: "INSUFFICIENT_CREDITS" } } },
  });
  await assertRejects(
    () => publishSpace(ctx, {}),
    Error,
    "Not enough credits",
  );
});

Deno.test("publishSpace: unwraps single-row array from RPC", async () => {
  const { ctx } = makeCtx({
    rpc: { publish_space_tx: publishOk("sp-1", 42, 7) },
  });
  const r = await publishSpace(ctx, {});
  assertEquals(r, { spaceId: "sp-1", freeCredits: 42, paidCredits: 7 });
});

// ─── attachToCollection ────────────────────────────────────────────────────
Deno.test("attachToCollection: rejects when collection is not owned by caller", async () => {
  const { ctx } = makeCtx({
    from: {
      collections: {
        select: { data: { id: "c1", user_id: "someone-else" }, error: null },
      },
    },
  });
  await assertRejects(
    () => attachToCollection(ctx, "space-1", "c1"),
    Error,
    "not owned",
  );
});

Deno.test("attachToCollection: rejects when collection does not exist", async () => {
  const { ctx } = makeCtx({
    from: { collections: { select: { data: null, error: null } } },
  });
  await assertRejects(
    () => attachToCollection(ctx, "space-1", "missing"),
    Error,
    "does not exist",
  );
});

Deno.test("attachToCollection: inserts into collection_spaces when owned", async () => {
  const { ctx, fromCalls } = makeCtx({
    from: {
      collections: {
        select: { data: { id: "c1", user_id: "user-1" }, error: null },
      },
      collection_spaces: { insert: { error: null } },
    },
  });
  await attachToCollection(ctx, "space-1", "c1");
  const insertCall = fromCalls.find(
    (c) => c.table === "collection_spaces" && c.terminal === "insert",
  );
  assert(insertCall, "expected insert into collection_spaces");
  assertEquals(insertCall!.insert, { collection_id: "c1", space_id: "space-1" });
});
