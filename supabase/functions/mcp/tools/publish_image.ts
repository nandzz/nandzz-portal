import type { ToolDefinition, ToolHandler } from "./types.ts";
import {
  attachToCollection,
  commonPublishProps,
  decodeBase64,
  fetchBytes,
  publishSpace,
  requireStr,
  requireVisibility,
  successResult,
  uploadToBucket,
  type CommonPublishArgs,
} from "./_shared.ts";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // matches space-images bucket limit
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function extFor(contentType: string): string {
  switch (contentType) {
    case "image/jpeg": return "jpg";
    case "image/png":  return "png";
    case "image/gif":  return "gif";
    case "image/webp": return "webp";
    default: return "bin";
  }
}

export const publishImageDef: ToolDefinition = {
  name: "publish_image",
  description:
    "Publish an image to the caller's Nandzz space. Provide either content_base64 (with media_type) or source_url (remote URL). Requires the user's explicit visibility choice. Costs credits.",
  inputSchema: {
    type: "object",
    required: ["title", "visibility"],
    properties: {
      ...commonPublishProps,
      content_base64: {
        type: "string",
        contentEncoding: "base64",
        description: "Image bytes as base64. When used, media_type must also be provided.",
      },
      media_type: {
        type: "string",
        enum: ["image/jpeg", "image/png", "image/gif", "image/webp"],
        description: "MIME type of content_base64.",
      },
      source_url: {
        type: "string",
        format: "uri",
        description: "URL to fetch the image from. Provide exactly one of content_base64 or source_url.",
      },
    },
    additionalProperties: false,
  },
};

export const publishImage: ToolHandler = async (args, ctx) => {
  const a = args as CommonPublishArgs & {
    content_base64?: string;
    media_type?: string;
    source_url?: string;
  };
  const title = requireStr(a.title, "title");
  const visibility = requireVisibility(a.visibility);

  if ((!a.content_base64) === (!a.source_url)) {
    throw new Error("Provide exactly one of content_base64 or source_url.");
  }

  let bytes: Uint8Array;
  let contentType: string;

  if (a.content_base64) {
    if (!a.media_type || !ALLOWED_TYPES.has(a.media_type)) {
      throw new Error("media_type required for content_base64 (image/jpeg|png|gif|webp).");
    }
    bytes = decodeBase64(a.content_base64);
    contentType = a.media_type;
  } else {
    const fetched = await fetchBytes(a.source_url!, MAX_IMAGE_BYTES);
    if (!ALLOWED_TYPES.has(fetched.contentType)) {
      throw new Error(`Unsupported image type from source_url: ${fetched.contentType}`);
    }
    bytes = fetched.bytes;
    contentType = fetched.contentType;
  }

  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`Image too large (>${MAX_IMAGE_BYTES} bytes).`);
  }

  const asset = await uploadToBucket(ctx, "space-images", bytes, `image.${extFor(contentType)}`, contentType);
  const { spaceId, freeCredits, paidCredits } = await publishSpace(ctx, {
    title,
    description: a.description ?? null,
    image_url: asset.publicUrl,
    preview_image_url: asset.publicUrl,
    is_public: visibility === "public",
    hashtags: a.hashtags ?? [],
  });

  if (a.collection_id) await attachToCollection(ctx, spaceId, a.collection_id);

  return successResult({
    spaceId,
    publicUrl: asset.publicUrl,
    visibility,
    collectionAttached: a.collection_id ?? null,
    remainingCredits: { free: freeCredits, paid: paidCredits },
    title,
  });
};
