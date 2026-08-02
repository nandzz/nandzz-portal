import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { publishHtml } from "../tools/publish_html.ts";
import { makeCtx, publishOk } from "./fakes.ts";

const okRpc = { publish_space_tx: publishOk("space-1", 90, 0) };

Deno.test("publish_html: uploads html and calls publish_space_tx", async () => {
  const { ctx, rpcCalls, storageUploads } = makeCtx({ rpc: okRpc });

  const res = await publishHtml(
    {
      title: "Hello",
      visibility: "public",
      html: "<!doctype html><h1>hi</h1>",
      hashtags: ["a", "b"],
    },
    ctx,
  );

  assertEquals(storageUploads.length, 1);
  assertEquals(storageUploads[0].bucket, "space-html");
  assertStringIncludes(storageUploads[0].path, "user-1/");
  assertStringIncludes(storageUploads[0].path, "index.html");
  assertEquals(storageUploads[0].contentType, "text/html; charset=utf-8");

  assertEquals(rpcCalls[0].name, "publish_space_tx");
  const payload = (rpcCalls[0].args as { p_space_payload: Record<string, unknown> })
    .p_space_payload;
  assertEquals(payload.title, "Hello");
  assertEquals(payload.is_public, true);
  assertEquals(payload.hashtags, ["a", "b"]);
  assertStringIncludes(payload.html_url as string, "space-html/");

  assertEquals(res.structuredContent?.visibility, "public");
  assertEquals(res.structuredContent?.space_id, "space-1");
  assertEquals(res.structuredContent?.remaining_credits, { free: 90, paid: 0 });
  // The response must return the Portal space URL (which enforces is_public),
  // NOT the raw Supabase storage URL (which is publicly fetchable and would
  // leak private assets).
  assertEquals(
    res.structuredContent?.space_url,
    "https://nandzz.com/user-1/space/space-1",
  );
  assertEquals(res.structuredContent?.public_url, undefined);
});

Deno.test("publish_html: rejects when title is missing", async () => {
  const { ctx } = makeCtx({ rpc: okRpc });
  await assertRejects(
    () => publishHtml({ visibility: "public", html: "<p>x</p>" }, ctx),
    Error,
    "title",
  );
});

Deno.test("publish_html: rejects when visibility is missing", async () => {
  const { ctx } = makeCtx({ rpc: okRpc });
  await assertRejects(
    () => publishHtml({ title: "t", html: "<p>x</p>" }, ctx),
    Error,
    "visibility",
  );
});

Deno.test("publish_html: rejects when html body is missing", async () => {
  const { ctx } = makeCtx({ rpc: okRpc });
  await assertRejects(
    () => publishHtml({ title: "t", visibility: "private" }, ctx),
    Error,
    "html",
  );
});

Deno.test("publish_html: rejects payloads > 2 MB", async () => {
  const { ctx, storageUploads } = makeCtx({ rpc: okRpc });
  const oversize = "x".repeat(2 * 1024 * 1024 + 1);
  await assertRejects(
    () => publishHtml({ title: "t", visibility: "private", html: oversize }, ctx),
    Error,
    "HTML too large",
  );
  assertEquals(storageUploads.length, 0, "must not upload oversize payloads");
});

Deno.test("publish_html: attaches to collection when collection_id is given", async () => {
  const { ctx, fromCalls } = makeCtx({
    rpc: okRpc,
    from: {
      collections: {
        select: { data: { id: "c1", user_id: "user-1" }, error: null },
      },
      collection_spaces: { insert: { error: null } },
    },
  });

  const res = await publishHtml(
    { title: "t", visibility: "private", html: "<p>x</p>", collection_id: "c1" },
    ctx,
  );

  const insertCall = fromCalls.find(
    (c) => c.table === "collection_spaces" && c.terminal === "insert",
  );
  assert(insertCall, "expected collection_spaces insert");
  assertEquals(insertCall!.insert, { collection_id: "c1", space_id: "space-1" });
  assertEquals(res.structuredContent?.collection_id, "c1");
});

Deno.test("publish_html: private visibility maps to is_public=false", async () => {
  const { ctx, rpcCalls } = makeCtx({ rpc: okRpc });
  await publishHtml({ title: "t", visibility: "private", html: "<p>x</p>" }, ctx);
  const payload = (rpcCalls[0].args as { p_space_payload: Record<string, unknown> })
    .p_space_payload;
  assertEquals(payload.is_public, false);
});
