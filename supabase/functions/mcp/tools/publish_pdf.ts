import type { ToolDefinition, ToolHandler } from "./types.ts";
import {
  attachToCollection,
  buildSpaceUrl,
  commonPublishProps,
  decodeBase64,
  fetchBytes,
  getUsername,
  publishSpace,
  requireStr,
  requireVisibility,
  successResult,
  uploadToBucket,
  type CommonPublishArgs,
} from "./_shared.ts";

const MAX_PDF_BYTES = 10 * 1024 * 1024; // matches space-pdfs bucket limit

export const publishPdfDef: ToolDefinition = {
  name: "publish_pdf",
  description:
    "Publish a PDF to the caller's Nandzz space. Provide either content_base64 (raw bytes) or source_url (remote URL). Requires the user's explicit visibility choice. Costs credits.",
  inputSchema: {
    type: "object",
    required: ["title", "visibility"],
    properties: {
      ...commonPublishProps,
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

export const publishPdf: ToolHandler = async (args, ctx) => {
  const a = args as CommonPublishArgs & { content_base64?: string; source_url?: string };
  const title = requireStr(a.title, "title");
  const visibility = requireVisibility(a.visibility);

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

  const asset = await uploadToBucket(ctx, "space-pdfs", bytes, "file.pdf", "application/pdf");
  const { spaceId, freeCredits, paidCredits } = await publishSpace(ctx, {
    title,
    description: a.description ?? null,
    pdf_url: asset.publicUrl,
    is_public: visibility === "public",
    hashtags: a.hashtags ?? [],
  });

  if (a.collection_id) await attachToCollection(ctx, spaceId, a.collection_id);

  const username = await getUsername(ctx);
  return successResult({
    spaceId,
    spaceUrl: buildSpaceUrl(username, spaceId),
    visibility,
    collectionAttached: a.collection_id ?? null,
    remainingCredits: { free: freeCredits, paid: paidCredits },
    title,
  });
};
