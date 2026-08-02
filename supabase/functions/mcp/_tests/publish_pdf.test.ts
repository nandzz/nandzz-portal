import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { publishPdf } from "../tools/publish_pdf.ts";
import { makeCtx, publishOk } from "./fakes.ts";

const okRpc = { publish_space_tx: publishOk("space-1", 90, 0) };
// Minimal 4-byte "PDF" — just needs to survive base64 round-trip.
const smallPdfBase64 = btoa("%PDF");

Deno.test("publish_pdf: base64 body uploads and calls publish_space_tx", async () => {
  const { ctx, rpcCalls, storageUploads } = makeCtx({ rpc: okRpc });

  await publishPdf(
    { title: "Doc", visibility: "public", content_base64: smallPdfBase64 },
    ctx,
  );

  assertEquals(storageUploads.length, 1);
  assertEquals(storageUploads[0].bucket, "space-pdfs");
  assertEquals(storageUploads[0].contentType, "application/pdf");
  assertStringIncludes(storageUploads[0].path, "file.pdf");

  const payload = (rpcCalls[0].args as { p_space_payload: Record<string, unknown> })
    .p_space_payload;
  assertStringIncludes(payload.pdf_url as string, "space-pdfs/");
});

Deno.test("publish_pdf: rejects when both content_base64 and source_url are given", async () => {
  const { ctx } = makeCtx({ rpc: okRpc });
  await assertRejects(
    () =>
      publishPdf(
        {
          title: "t",
          visibility: "public",
          content_base64: smallPdfBase64,
          source_url: "https://example.com/x.pdf",
        },
        ctx,
      ),
    Error,
    "exactly one",
  );
});

Deno.test("publish_pdf: rejects when neither content_base64 nor source_url is given", async () => {
  const { ctx } = makeCtx({ rpc: okRpc });
  await assertRejects(
    () => publishPdf({ title: "t", visibility: "public" }, ctx),
    Error,
    "exactly one",
  );
});

Deno.test("publish_pdf: rejects oversize base64 (>10 MB) before uploading", async () => {
  const { ctx, storageUploads } = makeCtx({ rpc: okRpc });
  // 10 MB + 1 byte of raw content
  const bytes = new Uint8Array(10 * 1024 * 1024 + 1).fill(65);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const oversize = btoa(bin);

  await assertRejects(
    () =>
      publishPdf(
        { title: "t", visibility: "private", content_base64: oversize },
        ctx,
      ),
    Error,
    "PDF too large",
  );
  assertEquals(storageUploads.length, 0);
});

Deno.test("publish_pdf: missing visibility rejected", async () => {
  const { ctx } = makeCtx({ rpc: okRpc });
  await assertRejects(
    () => publishPdf({ title: "t", content_base64: smallPdfBase64 }, ctx),
    Error,
    "visibility",
  );
});
