import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { updateImage } from "../tools/update_image.ts";
import { makeCtx } from "./fakes.ts";

const OLD_IMG_URL = "https://cdn.example/space-images/user-1/old-image.png";
const smallPngBase64 = btoa("\x89PNG\r\n\x1a\n");

function spaceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: {
      id: "space-1",
      user_id: "user-1",
      html_url: null,
      pdf_url: null,
      image_url: OLD_IMG_URL,
      ...overrides,
    },
    error: null,
  };
}

Deno.test("update_image: base64 + media_type uploads and updates image_url only", async () => {
  const { ctx, fromCalls, storageUploads } = makeCtx({
    from: { spaces: { select: spaceRow() } },
  });

  const res = await updateImage(
    {
      space_id: "space-1",
      content_base64: smallPngBase64,
      media_type: "image/png",
    },
    ctx,
  );

  assertEquals(storageUploads.length, 1);
  assertEquals(storageUploads[0].bucket, "space-images");
  assertEquals(storageUploads[0].contentType, "image/png");
  assertStringIncludes(storageUploads[0].path, "image.png");

  const updateCall = fromCalls.find(
    (c) => c.table === "spaces" && c.terminal === "update",
  );
  assert(updateCall);
  // preview_image_url intentionally NOT touched.
  assertEquals(Object.keys(updateCall!.update ?? {}), ["image_url"]);

  assertEquals(
    res.structuredContent?.space_url,
    "https://nandzz.com/user-1/space/space-1",
  );
  // The raw storage URL must NOT leak — it bypasses per-space privacy.
  assertEquals(res.structuredContent?.public_url, undefined);
  assertEquals(res.structuredContent?.previous_url, undefined);
});

Deno.test("update_image: lookup by url — filters on image_url + user_id", async () => {
  const { ctx, fromCalls } = makeCtx({
    from: { spaces: { select: spaceRow() } },
  });

  await updateImage(
    { url: OLD_IMG_URL, content_base64: smallPngBase64, media_type: "image/png" },
    ctx,
  );

  const lookupCall = fromCalls.find(
    (c) => c.table === "spaces" && c.terminal === "maybeSingle",
  );
  assert(lookupCall);
  assert(lookupCall!.eq.some(([c, v]) => c === "image_url" && v === OLD_IMG_URL));
  assert(lookupCall!.eq.some(([c, v]) => c === "user_id" && v === "user-1"));
});

Deno.test("update_image: refuses when space is not owned (row not found)", async () => {
  const { ctx } = makeCtx({
    from: { spaces: { select: { data: null, error: null } } },
  });
  await assertRejects(
    () =>
      updateImage(
        {
          space_id: "space-1",
          content_base64: smallPngBase64,
          media_type: "image/png",
        },
        ctx,
      ),
    Error,
    "not owned",
  );
});

Deno.test("update_image: refuses when target space has no image_url (wrong asset type)", async () => {
  const { ctx, storageUploads } = makeCtx({
    from: {
      spaces: {
        select: spaceRow({ image_url: null, pdf_url: "https://cdn/x.pdf" }),
      },
    },
  });
  await assertRejects(
    () =>
      updateImage(
        {
          space_id: "space-1",
          content_base64: smallPngBase64,
          media_type: "image/png",
        },
        ctx,
      ),
    Error,
    "not a IMAGE space",
  );
  assertEquals(storageUploads.length, 0);
});

Deno.test("update_image: base64 without media_type is rejected", async () => {
  const { ctx } = makeCtx({ from: { spaces: { select: spaceRow() } } });
  await assertRejects(
    () =>
      updateImage(
        { space_id: "space-1", content_base64: smallPngBase64 },
        ctx,
      ),
    Error,
    "media_type",
  );
});

Deno.test("update_image: rejects when both space_id and url are given", async () => {
  const { ctx } = makeCtx();
  await assertRejects(
    () =>
      updateImage(
        {
          space_id: "space-1",
          url: OLD_IMG_URL,
          content_base64: smallPngBase64,
          media_type: "image/png",
        },
        ctx,
      ),
    Error,
    "exactly one",
  );
});

Deno.test("update_image: rejects when neither space_id nor url is given", async () => {
  const { ctx } = makeCtx();
  await assertRejects(
    () =>
      updateImage(
        { content_base64: smallPngBase64, media_type: "image/png" },
        ctx,
      ),
    Error,
    "exactly one",
  );
});

Deno.test("update_image: rejects when neither content_base64 nor source_url is given", async () => {
  const { ctx } = makeCtx({ from: { spaces: { select: spaceRow() } } });
  await assertRejects(
    () => updateImage({ space_id: "space-1" }, ctx),
    Error,
    "exactly one",
  );
});
