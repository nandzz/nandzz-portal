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

export const updateImageDef: ToolDefinition = {
  name: "update_image",
  description:
    "Replace the image asset of an already-published space. Free (no credits). Provide space_id XOR url (the current image_url), plus content_base64 (with media_type) XOR source_url. Metadata is handled by update_space_metadata. Note: preview_image_url is NOT touched by this tool.",
  inputSchema: {
    type: "object",
    properties: {
      space_id: {
        type: "string",
        description: "UUID of the space to update. Provide exactly one of space_id or url.",
      },
      url: {
        type: "string",
        description: "Current image_url of the space to update. Provide exactly one of space_id or url.",
      },
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

export const updateImage: ToolHandler = async (args, ctx) => {
  const a = args as {
    space_id?: string;
    url?: string;
    content_base64?: string;
    media_type?: string;
    source_url?: string;
  };
  const lookup = requireOneLookup(a.space_id, a.url);

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

  const space = await resolveSpaceForAssetUpdate(ctx, lookup, "image");
  const asset = await uploadToBucket(ctx, "space-images", bytes, `image.${extFor(contentType)}`, contentType);

  // cleanup TODO — needs orphan sweeper; skipping deletion of the old blob so
  // cached URLs don't 404 mid-cutover. preview_image_url intentionally left
  // as-is: the preview is generated separately and may point elsewhere.
  const { error } = await ctx.admin
    .from("spaces")
    .update({ image_url: asset.publicUrl })
    .eq("id", space.id)
    .eq("user_id", ctx.userId);
  if (error) throw new Error(`Failed to update space: ${error.message}`);

  const username = await getUsername(ctx);
  return updateSuccessResult({
    spaceId: space.id,
    spaceUrl: buildSpaceUrl(username, space.id),
    kind: "image",
  });
};
