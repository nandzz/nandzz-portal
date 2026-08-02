import {
  assert,
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { updateSpaceMetadata } from "../tools/update_space_metadata.ts";
import { makeCtx } from "./fakes.ts";

const HTML_URL = "https://cdn.example/space-html/user-1/index.html";

function spaceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: {
      id: "space-1",
      user_id: "user-1",
      html_url: HTML_URL,
      pdf_url: null,
      image_url: null,
      ...overrides,
    },
    error: null,
  };
}

Deno.test("update_space_metadata: sets title + visibility, maps visibility→is_public", async () => {
  const { ctx, fromCalls } = makeCtx({
    from: { spaces: { select: spaceRow() } },
  });

  const res = await updateSpaceMetadata(
    { space_id: "space-1", title: "New title", visibility: "private" },
    ctx,
  );

  const updateCall = fromCalls.find(
    (c) => c.table === "spaces" && c.terminal === "update",
  );
  assert(updateCall);
  assertEquals(updateCall!.update, { title: "New title", is_public: false });
  assert(updateCall!.eq.some(([c, v]) => c === "id" && v === "space-1"));
  assert(updateCall!.eq.some(([c, v]) => c === "user_id" && v === "user-1"));

  assertEquals(res.structuredContent?.updated_fields, ["title", "visibility"]);
});

Deno.test("update_space_metadata: description=null clears the field", async () => {
  const { ctx, fromCalls } = makeCtx({
    from: { spaces: { select: spaceRow() } },
  });

  await updateSpaceMetadata({ space_id: "space-1", description: null }, ctx);

  const updateCall = fromCalls.find(
    (c) => c.table === "spaces" && c.terminal === "update",
  );
  assertEquals(updateCall!.update, { description: null });
});

Deno.test("update_space_metadata: hashtags=[] clears the tags", async () => {
  const { ctx, fromCalls } = makeCtx({
    from: { spaces: { select: spaceRow() } },
  });

  await updateSpaceMetadata({ space_id: "space-1", hashtags: [] }, ctx);

  const updateCall = fromCalls.find(
    (c) => c.table === "spaces" && c.terminal === "update",
  );
  assertEquals(updateCall!.update, { hashtags: [] });
});

Deno.test("update_space_metadata: lookup by url uses .or() across all three asset columns", async () => {
  const { ctx, fromCalls } = makeCtx({
    from: { spaces: { select: spaceRow() } },
  });

  await updateSpaceMetadata({ url: HTML_URL, title: "t" }, ctx);

  const lookupCall = fromCalls.find(
    (c) => c.table === "spaces" && c.terminal === "maybeSingle",
  );
  assert(lookupCall);
  assertEquals(lookupCall!.or.length, 1);
  const expr = lookupCall!.or[0];
  assert(expr.includes(`html_url.eq.${HTML_URL}`));
  assert(expr.includes(`pdf_url.eq.${HTML_URL}`));
  assert(expr.includes(`image_url.eq.${HTML_URL}`));
  assert(lookupCall!.eq.some(([c, v]) => c === "user_id" && v === "user-1"));
});

Deno.test("update_space_metadata: refuses when space is not owned (row not found)", async () => {
  const { ctx } = makeCtx({
    from: { spaces: { select: { data: null, error: null } } },
  });
  await assertRejects(
    () => updateSpaceMetadata({ space_id: "space-1", title: "t" }, ctx),
    Error,
    "not owned",
  );
});

Deno.test("update_space_metadata: rejects when no updatable field is provided", async () => {
  const { ctx, fromCalls } = makeCtx({
    from: { spaces: { select: spaceRow() } },
  });
  await assertRejects(
    () => updateSpaceMetadata({ space_id: "space-1" }, ctx),
    Error,
    "at least one field",
  );
  // Must fail before hitting the DB — the check is arg-side.
  assert(!fromCalls.some((c) => c.table === "spaces"));
});

Deno.test("update_space_metadata: rejects when both space_id and url are given", async () => {
  const { ctx } = makeCtx();
  await assertRejects(
    () =>
      updateSpaceMetadata(
        { space_id: "space-1", url: HTML_URL, title: "t" },
        ctx,
      ),
    Error,
    "exactly one",
  );
});

Deno.test("update_space_metadata: rejects when neither space_id nor url is given", async () => {
  const { ctx } = makeCtx();
  await assertRejects(
    () => updateSpaceMetadata({ title: "t" }, ctx),
    Error,
    "exactly one",
  );
});
