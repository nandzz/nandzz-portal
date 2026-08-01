import type { Ctx, ToolResult } from "./types.ts";

// Fields that every publish_* tool exposes to the caller.
export const commonPublishProps = {
  title: {
    type: "string",
    description: "Human-readable title for the publication. Shown in the user's space.",
  },
  description: {
    type: "string",
    description: "Optional short description (1–2 sentences).",
  },
  visibility: {
    type: "string",
    enum: ["private", "public"],
    description:
      "REQUIRED. 'public' makes it discoverable in the user's Nandzz profile; 'private' keeps it out of listings. Ask the user — do not guess.",
  },
  collection_id: {
    type: ["string", "null"],
    description:
      "Optional collection UUID from list_collections. If provided, the publication is added to that collection after creation.",
  },
  hashtags: {
    type: "array",
    items: { type: "string" },
    description: "Optional tags for discovery (only used when visibility=public).",
  },
} as const;

export type CommonPublishArgs = {
  title?: string;
  description?: string;
  visibility?: "private" | "public";
  collection_id?: string | null;
  hashtags?: string[];
};

export function requireStr(v: unknown, field: string): string {
  if (typeof v !== "string" || v.trim() === "") {
    throw new Error(`Missing required field: ${field}`);
  }
  return v;
}

export function requireVisibility(v: unknown): "private" | "public" {
  if (v !== "private" && v !== "public") {
    throw new Error(
      "Missing required field: visibility. Ask the user whether this should be 'private' (hidden from their profile) or 'public'."
    );
  }
  return v;
}

// Base64 → Uint8Array. Accepts data URIs too.
export function decodeBase64(input: string): Uint8Array {
  const commaIdx = input.indexOf(",");
  const b64 = input.startsWith("data:") && commaIdx !== -1 ? input.slice(commaIdx + 1) : input;
  const bin = atob(b64.replace(/\s+/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Fetch remote URL → Uint8Array (with a size cap so a hostile URL can't OOM us).
export async function fetchBytes(url: string, maxBytes: number): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) {
    throw new Error(`Remote asset too large: ${buf.byteLength} bytes > ${maxBytes} bytes`);
  }
  return { bytes: buf, contentType: res.headers.get("content-type") ?? "application/octet-stream" };
}

export type UploadedAsset = { path: string; publicUrl: string };

export async function uploadToBucket(
  ctx: Ctx,
  bucket: string,
  bytes: Uint8Array | string,
  filename: string,
  contentType: string
): Promise<UploadedAsset> {
  // Bucket policies key ownership on the first path segment being auth.uid()::text.
  const path = `${ctx.userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${filename}`;
  const { error } = await ctx.admin.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Storage upload failed (${bucket}): ${error.message}`);
  const { data } = ctx.admin.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

// Insert the space row atomically via the existing publish_space_tx RPC.
// Handles credit deduction; throws INSUFFICIENT_CREDITS if the user is broke.
export async function publishSpace(
  ctx: Ctx,
  payload: Record<string, unknown>
): Promise<{ spaceId: string; freeCredits: number; paidCredits: number }> {
  const { data, error } = await ctx.admin.rpc("publish_space_tx", {
    p_user_id: ctx.userId,
    p_space_payload: payload,
    p_client_request_id: crypto.randomUUID(),
    p_cost: null,
  });
  if (error) {
    if (error.message?.includes("INSUFFICIENT_CREDITS")) {
      throw new Error(
        "Not enough credits to publish. The user needs to purchase more credits in the Nandzz app."
      );
    }
    throw new Error(`Publish failed: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    spaceId: row.space_id as string,
    freeCredits: row.free_space_credits as number,
    paidCredits: row.paid_credits as number,
  };
}

export async function attachToCollection(ctx: Ctx, spaceId: string, collectionId: string): Promise<void> {
  // Verify ownership of the collection before attaching — the caller supplied
  // the id and we're running with service role, so RLS isn't checking for us.
  const { data: col, error: colErr } = await ctx.admin
    .from("collections")
    .select("id, user_id")
    .eq("id", collectionId)
    .maybeSingle();
  if (colErr) throw new Error(`Collection lookup failed: ${colErr.message}`);
  if (!col || col.user_id !== ctx.userId) {
    throw new Error(`Collection ${collectionId} does not exist or is not owned by you.`);
  }
  const { error: insErr } = await ctx.admin
    .from("collection_spaces")
    .insert({ collection_id: collectionId, space_id: spaceId });
  if (insErr) throw new Error(`Failed to add to collection: ${insErr.message}`);
}

export function successResult(opts: {
  spaceId: string;
  publicUrl: string;
  visibility: "private" | "public";
  collectionAttached: string | null;
  remainingCredits: { free: number; paid: number };
  title: string;
}): ToolResult {
  const parts: string[] = [
    `Published "${opts.title}" as ${opts.visibility}.`,
    `Asset URL: ${opts.publicUrl}`,
    `Space ID: ${opts.spaceId}`,
  ];
  if (opts.collectionAttached) parts.push(`Added to collection ${opts.collectionAttached}.`);
  parts.push(`Remaining credits — free: ${opts.remainingCredits.free}, paid: ${opts.remainingCredits.paid}.`);
  return {
    content: [{ type: "text", text: parts.join("\n") }],
    structuredContent: {
      space_id: opts.spaceId,
      public_url: opts.publicUrl,
      visibility: opts.visibility,
      collection_id: opts.collectionAttached,
      remaining_credits: opts.remainingCredits,
    },
  };
}
