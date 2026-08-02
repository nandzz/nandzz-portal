import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { updatePdf } from "../tools/update_pdf.ts";
import { makeCtx } from "./fakes.ts";

const OLD_PDF_URL = "https://cdn.example/space-pdfs/user-1/old-file.pdf";
const smallPdfBase64 = btoa("%PDF");

function spaceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: {
      id: "space-1",
      user_id: "user-1",
      html_url: null,
      pdf_url: OLD_PDF_URL,
      image_url: null,
      ...overrides,
    },
    error: null,
  };
}

Deno.test("update_pdf: base64 body — uploads and updates pdf_url", async () => {
  const { ctx, fromCalls, storageUploads } = makeCtx({
    from: { spaces: { select: spaceRow() } },
  });

  const res = await updatePdf(
    { space_id: "space-1", content_base64: smallPdfBase64 },
    ctx,
  );

  assertEquals(storageUploads.length, 1);
  assertEquals(storageUploads[0].bucket, "space-pdfs");
  assertEquals(storageUploads[0].contentType, "application/pdf");

  const updateCall = fromCalls.find(
    (c) => c.table === "spaces" && c.terminal === "update",
  );
  assert(updateCall);
  assertEquals(Object.keys(updateCall!.update ?? {}), ["pdf_url"]);
  assert(updateCall!.eq.some(([c, v]) => c === "user_id" && v === "user-1"));

  assertEquals(
    res.structuredContent?.space_url,
    "https://nandzz.com/user-1/space/space-1",
  );
  // The raw storage URL must NOT leak — it bypasses per-space privacy.
  assertEquals(res.structuredContent?.public_url, undefined);
  assertEquals(res.structuredContent?.previous_url, undefined);
});

Deno.test("update_pdf: lookup by url — filters on pdf_url + user_id", async () => {
  const { ctx, fromCalls } = makeCtx({
    from: { spaces: { select: spaceRow() } },
  });

  await updatePdf({ url: OLD_PDF_URL, content_base64: smallPdfBase64 }, ctx);

  const lookupCall = fromCalls.find(
    (c) => c.table === "spaces" && c.terminal === "maybeSingle",
  );
  assert(lookupCall);
  assert(lookupCall!.eq.some(([c, v]) => c === "pdf_url" && v === OLD_PDF_URL));
  assert(lookupCall!.eq.some(([c, v]) => c === "user_id" && v === "user-1"));
});

Deno.test("update_pdf: refuses when space is not owned (row not found)", async () => {
  const { ctx } = makeCtx({
    from: { spaces: { select: { data: null, error: null } } },
  });
  await assertRejects(
    () =>
      updatePdf(
        { space_id: "space-1", content_base64: smallPdfBase64 },
        ctx,
      ),
    Error,
    "not owned",
  );
});

Deno.test("update_pdf: refuses when target space has no pdf_url (wrong asset type)", async () => {
  const { ctx, storageUploads } = makeCtx({
    from: {
      spaces: {
        select: spaceRow({ pdf_url: null, html_url: "https://cdn/x.html" }),
      },
    },
  });
  await assertRejects(
    () =>
      updatePdf(
        { space_id: "space-1", content_base64: smallPdfBase64 },
        ctx,
      ),
    Error,
    "not a PDF space",
  );
  assertEquals(storageUploads.length, 0);
});

Deno.test("update_pdf: rejects when both space_id and url are given", async () => {
  const { ctx } = makeCtx();
  await assertRejects(
    () =>
      updatePdf(
        {
          space_id: "space-1",
          url: OLD_PDF_URL,
          content_base64: smallPdfBase64,
        },
        ctx,
      ),
    Error,
    "exactly one",
  );
});

Deno.test("update_pdf: rejects when neither space_id nor url is given", async () => {
  const { ctx } = makeCtx();
  await assertRejects(
    () => updatePdf({ content_base64: smallPdfBase64 }, ctx),
    Error,
    "exactly one",
  );
});

Deno.test("update_pdf: rejects when both content_base64 and source_url are given", async () => {
  const { ctx } = makeCtx({ from: { spaces: { select: spaceRow() } } });
  await assertRejects(
    () =>
      updatePdf(
        {
          space_id: "space-1",
          content_base64: smallPdfBase64,
          source_url: "https://example.com/x.pdf",
        },
        ctx,
      ),
    Error,
    "exactly one",
  );
});

Deno.test("update_pdf: rejects when neither content_base64 nor source_url is given", async () => {
  const { ctx } = makeCtx({ from: { spaces: { select: spaceRow() } } });
  await assertRejects(
    () => updatePdf({ space_id: "space-1" }, ctx),
    Error,
    "exactly one",
  );
});
