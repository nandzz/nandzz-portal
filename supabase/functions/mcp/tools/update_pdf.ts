import type { ToolDefinition, ToolHandler } from "./types.ts";
import {
  buildSpaceUrl,
  decodeBase64,
  fetchBytes,
  getUsername,
  requireOneLookup,
  resolveSpaceForAssetUpdate,
  updateSuccessResult,
  uploadToBucket,
} from "./_shared.ts";

const MAX_PDF_BYTES = 10 * 1024 * 1024; // matches space-pdfs bucket limit

export const updatePdfDef: ToolDefinition = {
  name: "update_pdf",
  description:
    "Replace the PDF asset of an already-published space. Free (no credits). Provide space_id XOR url (the current pdf_url), plus content_base64 XOR source_url. Metadata is handled by update_space_metadata.",
  inputSchema: {
    type: "object",
    properties: {
      space_id: {
        type: "string",
        description: "UUID of the space to update. Provide exactly one of space_id or url.",
      },
      url: {
        type: "string",
        description: "Current pdf_url of the space to update. Provide exactly one of space_id or url.",
      },
      content_base64: {
        type: "string",
        contentEncoding: "base64",
        description: "PDF bytes as base64. Provide exactly one of content_base64 or source_url.",
      },
      source_url: {
        type: "string",
        format: "uri",
        description: "URL to fetch the PDF from. Provide exactly one of content_base64 or source_url.",
      },
    },
    additionalProperties: false,
  },
};

export const updatePdf: ToolHandler = async (args, ctx) => {
  const a = args as {
    space_id?: string;
    url?: string;
    content_base64?: string;
    source_url?: string;
  };
  const lookup = requireOneLookup(a.space_id, a.url);

  if ((!a.content_base64) === (!a.source_url)) {
    throw new Error("Provide exactly one of content_base64 or source_url.");
  }

  let bytes: Uint8Array;
  if (a.content_base64) {
    bytes = decodeBase64(a.content_base64);
    if (bytes.byteLength > MAX_PDF_BYTES) {
      throw new Error(`PDF too large (>${MAX_PDF_BYTES} bytes).`);
    }
  } else {
    const fetched = await fetchBytes(a.source_url!, MAX_PDF_BYTES);
    bytes = fetched.bytes;
  }

  const space = await resolveSpaceForAssetUpdate(ctx, lookup, "pdf");
  const asset = await uploadToBucket(ctx, "space-pdfs", bytes, "file.pdf", "application/pdf");

  // cleanup TODO — needs orphan sweeper; skipping deletion of the old blob so
  // cached URLs don't 404 mid-cutover.
  const { error } = await ctx.admin
    .from("spaces")
    .update({ pdf_url: asset.publicUrl })
    .eq("id", space.id)
    .eq("user_id", ctx.userId);
  if (error) throw new Error(`Failed to update space: ${error.message}`);

  const username = await getUsername(ctx);
  return updateSuccessResult({
    spaceId: space.id,
    spaceUrl: buildSpaceUrl(username, space.id),
    kind: "pdf",
  });
};
