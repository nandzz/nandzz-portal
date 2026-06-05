import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { classifyMime, mimeToExt, MIME_TO_EXT, FIELD_TO_BUCKET } from "../media.ts";

// classifyMime
Deno.test("classifyMime: image types map to image_url", () => {
  for (const mime of ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]) {
    assertEquals(classifyMime(mime), { kind: "storage", field: "image_url" }, `failed for ${mime}`);
  }
});

Deno.test("classifyMime: application/pdf maps to pdf_url", () => {
  assertEquals(classifyMime("application/pdf"), { kind: "storage", field: "pdf_url" });
});

Deno.test("classifyMime: text/html maps to html_url", () => {
  assertEquals(classifyMime("text/html"), { kind: "storage", field: "html_url" });
});

Deno.test("classifyMime: text variants map to markdown_content", () => {
  assertEquals(classifyMime("text/markdown"), { kind: "text", field: "markdown_content" });
  assertEquals(classifyMime("text/x-markdown"), { kind: "text", field: "markdown_content" });
  assertEquals(classifyMime("text/plain"), { kind: "text", field: "markdown_content" });
});

Deno.test("classifyMime: strips charset before classifying", () => {
  assertEquals(classifyMime("application/pdf; charset=utf-8"), { kind: "storage", field: "pdf_url" });
  assertEquals(classifyMime("image/jpeg; charset=binary"), { kind: "storage", field: "image_url" });
  assertEquals(classifyMime("text/plain; charset=utf-8"), { kind: "text", field: "markdown_content" });
});

Deno.test("classifyMime: case-insensitive", () => {
  assertEquals(classifyMime("Application/PDF"), { kind: "storage", field: "pdf_url" });
  assertEquals(classifyMime("IMAGE/JPEG"), { kind: "storage", field: "image_url" });
});

Deno.test("classifyMime: unsupported types return null", () => {
  assertEquals(classifyMime("video/mp4"), null);
  assertEquals(classifyMime("audio/mpeg"), null);
  assertEquals(classifyMime("application/octet-stream"), null);
  assertEquals(classifyMime(""), null);
});

// mimeToExt
Deno.test("mimeToExt: known types return correct extension", () => {
  assertEquals(mimeToExt("image/jpeg"), "jpg");
  assertEquals(mimeToExt("image/png"), "png");
  assertEquals(mimeToExt("application/pdf"), "pdf");
  assertEquals(mimeToExt("text/html"), "html");
  assertEquals(mimeToExt("text/markdown"), "md");
  assertEquals(mimeToExt("text/x-markdown"), "md");
  assertEquals(mimeToExt("text/plain"), "txt");
});

Deno.test("mimeToExt: strips charset before looking up extension", () => {
  assertEquals(mimeToExt("application/pdf; charset=utf-8"), "pdf");
  assertEquals(mimeToExt("image/png; charset=binary"), "png");
});

Deno.test("mimeToExt: falls back to subtype for unknown mime", () => {
  assertEquals(mimeToExt("image/avif"), "avif");
  assertEquals(mimeToExt("video/mp4"), "mp4");
});

Deno.test("FIELD_TO_BUCKET: each storage field maps to the correct bucket", () => {
  assertEquals(FIELD_TO_BUCKET["image_url"], "space-images");
  assertEquals(FIELD_TO_BUCKET["pdf_url"],   "space-pdfs");
  assertEquals(FIELD_TO_BUCKET["html_url"],  "space-html");
});

Deno.test("MIME_TO_EXT: all expected keys present", () => {
  const requiredKeys = [
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf", "text/html", "text/markdown", "text/x-markdown", "text/plain",
  ];
  for (const key of requiredKeys) {
    assertExists(MIME_TO_EXT[key], `missing key: ${key}`);
  }
});
