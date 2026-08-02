import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { publishImage, publishImageDef } from "../tools/publish_image.ts";
import { makeCtx, publishOk } from "./fakes.ts";

const okRpc = { publish_space_tx: publishOk("space-1", 90, 0) };
const smallPngBase64 = btoa("\x89PNG\r\n\x1a\n");

Deno.test("publish_image: base64 + media_type uploads to space-images", async () => {
  const { ctx, rpcCalls, storageUploads } = makeCtx({ rpc: okRpc });

  await publishImage(
    {
      title: "Pic",
      visibility: "private",
      content_base64: smallPngBase64,
      media_type: "image/png",
    },
    ctx,
  );

  assertEquals(storageUploads.length, 1);
  assertEquals(storageUploads[0].bucket, "space-images");
  assertEquals(storageUploads[0].contentType, "image/png");
  assertStringIncludes(storageUploads[0].path, "image.png");

  const payload = (rpcCalls[0].args as { p_space_payload: Record<string, unknown> })
    .p_space_payload;
  assertStringIncludes(payload.image_url as string, "space-images/");
  // Image previews reuse the asset URL directly so the feed has something to show.
  assertEquals(payload.preview_image_url, payload.image_url);
});

Deno.test("publish_image: base64 without media_type is rejected", async () => {
  const { ctx } = makeCtx({ rpc: okRpc });
  await assertRejects(
    () =>
      publishImage(
        { title: "t", visibility: "private", content_base64: smallPngBase64 },
        ctx,
      ),
    Error,
    "media_type",
  );
});

Deno.test("publish_image: base64 with disallowed media_type is rejected", async () => {
  const { ctx } = makeCtx({ rpc: okRpc });
  await assertRejects(
    () =>
      publishImage(
        {
          title: "t",
          visibility: "private",
          content_base64: smallPngBase64,
          media_type: "image/tiff",
        },
        ctx,
      ),
    Error,
    "media_type",
  );
});

Deno.test("publish_image: rejects when no file/source_url/content_base64 is given", async () => {
  const { ctx } = makeCtx({ rpc: okRpc });
  await assertRejects(
    () => publishImage({ title: "t", visibility: "public" }, ctx),
    Error,
    "file, source_url, or content_base64",
  );
});

Deno.test("publish_image: missing file.download_url is rejected", async () => {
  const { ctx } = makeCtx({ rpc: okRpc });
  await assertRejects(
    () =>
      publishImage(
        {
          title: "t",
          visibility: "private",
          file: { file_id: "file_abc" },
        },
        ctx,
      ),
    Error,
    "download_url",
  );
});

Deno.test("publish_image: `file` schema advertises openai/fileParams meta", () => {
  // Without _meta.openai/fileParams the ChatGPT connector runtime treats the
  // parameter as plain JSON and never auto-uploads user/AI-generated files.
  assertEquals(
    (publishImageDef._meta as { "openai/fileParams": string[] })?.["openai/fileParams"],
    ["file"],
  );
  const fileProp = (publishImageDef.inputSchema as {
    properties: { file: { type: string; required: string[] } };
  }).properties.file;
  assertEquals(fileProp.type, "object");
  assertEquals(fileProp.required, ["download_url", "file_id"]);
});

Deno.test("publish_image: missing title rejected", async () => {
  const { ctx } = makeCtx({ rpc: okRpc });
  await assertRejects(
    () =>
      publishImage(
        {
          visibility: "public",
          content_base64: smallPngBase64,
          media_type: "image/png",
        },
        ctx,
      ),
    Error,
    "title",
  );
});
