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

// ── SSRF guards for fetchBytes ──────────────────────────────────────────────
// The edge function runs on Supabase infra; without these checks, a caller
// could hand us `http://169.254.169.254/…` (cloud instance metadata) or an
// internal-network URL and have us proxy the response back.

function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

function isIPv4Literal(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function isIPv6Literal(host: string): boolean {
  return stripBrackets(host).includes(":");
}

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true;                          // 0.0.0.0/8
  if (a === 10) return true;                         // 10/8
  if (a === 127) return true;                        // loopback
  if (a === 169 && b === 254) return true;           // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16/12
  if (a === 192 && b === 168) return true;           // 192.168/16
  if (a >= 224) return true;                         // multicast + reserved
  return false;
}

// Parse any IPv6 form (compressed, expanded, IPv4-mapped, mixed case, zone id)
// into 8 numeric groups. Returns null if unparseable — callers should treat
// null as "blocked" rather than "allow through".
function parseIPv6(raw: string): number[] | null {
  // Strip zone identifier like "fe80::1%eth0" — irrelevant to block decision.
  let addr = raw.split("%")[0].toLowerCase();

  // If there's an embedded IPv4 tail (::ffff:1.2.3.4), convert those 4 octets
  // into two hex groups so the rest of the parser treats it uniformly.
  const v4tail = addr.match(/^(.*):(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4tail) {
    const [, prefix, v4] = v4tail;
    const octs = v4.split(".").map(Number);
    if (octs.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return null;
    const g1 = (((octs[0] << 8) | octs[1]) & 0xffff).toString(16);
    const g2 = (((octs[2] << 8) | octs[3]) & 0xffff).toString(16);
    addr = `${prefix}:${g1}:${g2}`;
  }

  // Split around at most one "::" (which stands in for a run of zero groups).
  const dblIdx = addr.indexOf("::");
  if (dblIdx !== addr.lastIndexOf("::")) return null;  // "::" may appear only once

  let leftPart: string;
  let rightPart: string;
  if (dblIdx === -1) {
    leftPart = addr;
    rightPart = "";
  } else {
    leftPart = addr.slice(0, dblIdx);
    rightPart = addr.slice(dblIdx + 2);
  }

  const left = leftPart === "" ? [] : leftPart.split(":");
  const right = rightPart === "" ? [] : rightPart.split(":");
  const missing = 8 - left.length - right.length;

  if (dblIdx === -1) {
    if (left.length !== 8) return null;
  } else if (missing < 0) {
    return null;
  }

  const groups = [
    ...left,
    ...Array(dblIdx === -1 ? 0 : missing).fill("0"),
    ...right,
  ];
  if (groups.length !== 8) return null;

  const parsed = groups.map((g) => (g === "" ? NaN : parseInt(g, 16)));
  if (parsed.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null;

  return parsed;
}

function isBlockedIPv6(ip: string): boolean {
  const groups = parseIPv6(stripBrackets(ip));
  if (!groups) return true;  // unparseable → block, don't allow through
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;

  // Unspecified :: and loopback ::1
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    if (g6 === 0 && g7 === 0) return true;    // ::
    if (g6 === 0 && g7 === 1) return true;    // ::1
  }
  // IPv4-mapped ::ffff:0:0/96 — decode the tail and reuse the v4 blocklist.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    const v4 = `${(g6 >> 8) & 0xff}.${g6 & 0xff}.${(g7 >> 8) & 0xff}.${g7 & 0xff}`;
    return isBlockedIPv4(v4);
  }
  // IPv4-compatible ::0:0:0:0:0:0:a.b.c.d — deprecated but same treatment.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    const v4 = `${(g6 >> 8) & 0xff}.${g6 & 0xff}.${(g7 >> 8) & 0xff}.${g7 & 0xff}`;
    if (isBlockedIPv4(v4)) return true;
  }
  if ((g0 & 0xfe00) === 0xfc00) return true;  // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true;  // fe80::/10 link-local
  if ((g0 & 0xff00) === 0xff00) return true;  // ff00::/8 multicast

  return false;
}

async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error(`Invalid URL: ${raw}`); }
  if (url.protocol !== "https:") {
    throw new Error(`Only https URLs are allowed (got ${url.protocol}).`);
  }
  const host = url.hostname;
  if (isIPv4Literal(host)) {
    if (isBlockedIPv4(host)) throw new Error(`Blocked IP in URL: ${host}`);
    return url;
  }
  if (isIPv6Literal(host)) {
    if (isBlockedIPv6(host)) throw new Error(`Blocked IP in URL: ${host}`);
    return url;
  }
  const [v4, v6] = await Promise.all([
    Deno.resolveDns(host, "A").catch(() => [] as string[]),
    Deno.resolveDns(host, "AAAA").catch(() => [] as string[]),
  ]);
  const ips = [...v4, ...v6];
  if (ips.length === 0) throw new Error(`Cannot resolve host: ${host}`);
  for (const ip of ips) {
    const blocked = ip.includes(":") ? isBlockedIPv6(ip) : isBlockedIPv4(ip);
    if (blocked) throw new Error(`Host ${host} resolves to blocked IP ${ip}.`);
  }
  return url;
}

// Fetch remote URL → Uint8Array. Handles redirects manually so each hop is
// re-validated (a 302 to a private IP would otherwise bypass the initial check).
export async function fetchBytes(url: string, maxBytes: number): Promise<{ bytes: Uint8Array; contentType: string }> {
  let current = url;
  for (let hop = 0; hop <= 3; hop++) {
    await assertSafeUrl(current);
    const res = await fetch(current, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error(`Redirect ${res.status} without Location header`);
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      throw new Error(`Remote asset too large: ${buf.byteLength} bytes > ${maxBytes} bytes`);
    }
    return { bytes: buf, contentType: res.headers.get("content-type") ?? "application/octet-stream" };
  }
  throw new Error("Too many redirects");
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
