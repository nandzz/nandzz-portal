import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { updateHtml } from "../tools/update_html.ts";
import { makeCtx } from "./fakes.ts";

const OLD_HTML_URL = "https://cdn.example/space-html/user-1/old-index.html";

function spaceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: {
      id: "space-1",
      user_id: "user-1",
      html_url: OLD_HTML_URL,
      pdf_url: null,
      image_url: null,
      ...overrides,
    },
    error: null,
  };
}

Deno.test("update_html: lookup by space_id — uploads, updates row, returns space URL only", async () => {
  const { ctx, fromCalls, storageUploads } = makeCtx({
    from: { spaces: { select: spaceRow() } },
  });

  const res = await updateHtml(
    { space_id: "space-1", html: "<!doctype html><h1>new</h1>" },
    ctx,
  );

  assertEquals(storageUploads.length, 1);
  assertEquals(storageUploads[0].bucket, "space-html");
  assertStringIncludes(storageUploads[0].path, "user-1/");
  assertEquals(storageUploads[0].contentType, "text/html; charset=utf-8");

  const updateCall = fromCalls.find(
    (c) => c.table === "spaces" && c.terminal === "update",
  );
  assert(updateCall, "expected spaces update");
  assertEquals(Object.keys(updateCall!.update ?? {}), ["html_url"]);
  // Ownership must be part of the update filter, not just the lookup.
  assert(updateCall!.eq.some(([c, v]) => c === "id" && v === "space-1"));
  assert(updateCall!.eq.some(([c, v]) => c === "user_id" && v === "user-1"));

  assertEquals(res.structuredContent?.space_id, "space-1");
  assertEquals(
    res.structuredContent?.space_url,
    "https://nandzz.com/user-1/space/space-1",
  );
  // The raw storage URL must NOT leak — it bypasses per-space privacy.
  assertEquals(res.structuredContent?.public_url, undefined);
  assertEquals(res.structuredContent?.previous_url, undefined);
});

Deno.test("update_html: lookup by url — filters on html_url + user_id", async () => {
  const { ctx, fromCalls } = makeCtx({
    from: { spaces: { select: spaceRow() } },
  });

  await updateHtml({ url: OLD_HTML_URL, html: "<p>new</p>" }, ctx);

  const lookupCall = fromCalls.find(
    (c) => c.table === "spaces" && c.terminal === "maybeSingle",
  );
  assert(lookupCall);
  assert(lookupCall!.eq.some(([c, v]) => c === "html_url" && v === OLD_HTML_URL));
  assert(lookupCall!.eq.some(([c, v]) => c === "user_id" && v === "user-1"));
});

Deno.test("update_html: refuses when space is not owned (row not found)", async () => {
  // Ownership is enforced by scoping .eq("user_id", …) in the lookup — the
  // service role bypasses RLS otherwise. A mismatched user returns null.
  const { ctx } = makeCtx({
    from: { spaces: { select: { data: null, error: null } } },
  });
  await assertRejects(
    () => updateHtml({ space_id: "space-1", html: "<p>x</p>" }, ctx),
    Error,
    "not owned",
  );
});

Deno.test("update_html: refuses when target space has no html_url (wrong asset type)", async () => {
  const { ctx, storageUploads, fromCalls } = makeCtx({
    from: {
      spaces: {
        select: spaceRow({ html_url: null, pdf_url: "https://cdn/x.pdf" }),
      },
    },
  });
  await assertRejects(
    () => updateHtml({ space_id: "space-1", html: "<p>x</p>" }, ctx),
    Error,
    "not a HTML space",
  );
  assertEquals(storageUploads.length, 0, "must not upload for wrong asset type");
  assert(!fromCalls.some((c) => c.terminal === "update"));
});

Deno.test("update_html: rejects when both space_id and url are given", async () => {
  const { ctx } = makeCtx();
  await assertRejects(
    () =>
      updateHtml(
        { space_id: "space-1", url: OLD_HTML_URL, html: "<p>x</p>" },
        ctx,
      ),
    Error,
    "exactly one",
  );
});

Deno.test("update_html: rejects when neither space_id nor url is given", async () => {
  const { ctx } = makeCtx();
  await assertRejects(
    () => updateHtml({ html: "<p>x</p>" }, ctx),
    Error,
    "exactly one",
  );
});

Deno.test("update_html: rejects oversize payloads before touching storage", async () => {
  const { ctx, storageUploads } = makeCtx({
    from: { spaces: { select: spaceRow() } },
  });
  const oversize = "x".repeat(2 * 1024 * 1024 + 1);
  await assertRejects(
    () => updateHtml({ space_id: "space-1", html: oversize }, ctx),
    Error,
    "HTML too large",
  );
  assertEquals(storageUploads.length, 0);
});

Deno.test("update_html: rejects missing html body", async () => {
  const { ctx } = makeCtx({ from: { spaces: { select: spaceRow() } } });
  await assertRejects(
    () => updateHtml({ space_id: "space-1" }, ctx),
    Error,
    "html",
  );
});
