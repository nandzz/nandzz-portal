import type { Ctx, ToolDefinition, ToolHandler, ToolResult } from "../../mcp/tools/types.ts";
import { fetchBytes, resolveFileInput, type OpenAIFileInput } from "../../mcp/tools/_shared.ts";

// Portal origin used to build public profile + claim links.
export const PORTAL_ORIGIN = Deno.env.get("PORTAL_ORIGIN") ?? "https://nandzz.com";

export function profileUrl(username: string): string {
  return `${PORTAL_ORIGIN}/${username}`;
}

export function textResult(text: string, structuredContent?: Record<string, unknown>): ToolResult {
  return { content: [{ type: "text", text }], ...(structuredContent ? { structuredContent } : {}) };
}

export function errorResult(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

// ── Demo target guard ──────────────────────────────────────────────────────
// Every admin tool that writes content takes `demo_profile_id` and must only
// ever act on a profile flagged is_demo — never a real user's account and
// never the admin's own.

export type DemoProfile = { id: string; username: string };

export async function requireDemo(ctx: Ctx, demoId: unknown): Promise<DemoProfile> {
  if (typeof demoId !== "string" || !/^[0-9a-f-]{36}$/i.test(demoId)) {
    throw new Error("demo_profile_id is required (UUID from create_demo_profile or list_demo_profiles).");
  }
  const { data, error } = await ctx.admin
    .from("profiles")
    .select("id, username, is_demo")
    .eq("id", demoId)
    .maybeSingle();
  if (error) throw new Error(`Profile lookup failed: ${error.message}`);
  const row = data as { id: string; username: string; is_demo: boolean } | null;
  if (!row || !row.is_demo) {
    throw new Error(`Profile ${demoId} is not a demo profile.`);
  }
  return { id: row.id, username: row.username };
}

export const demoProfileIdProp = {
  type: "string",
  description: "UUID of the demo profile to act on (from create_demo_profile or list_demo_profiles).",
} as const;

// Wrap a public-MCP tool so it runs against a demo profile: adds a required
// demo_profile_id, verifies the target is a demo, then runs the original
// handler with ctx.userId swapped to the demo's id (all public tools scope
// their reads/writes by ctx.userId).
export function onDemo(
  def: ToolDefinition,
  handler: ToolHandler,
): { def: ToolDefinition; handler: ToolHandler } {
  const schema = def.inputSchema as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  return {
    def: {
      ...def,
      description: `[Demo profile] ${def.description} Acts on the demo profile given by demo_profile_id.`,
      inputSchema: {
        ...def.inputSchema,
        properties: { demo_profile_id: demoProfileIdProp, ...(schema.properties ?? {}) },
        required: ["demo_profile_id", ...(schema.required ?? [])],
      },
    },
    handler: async (args, ctx) => {
      const demo = await requireDemo(ctx, args.demo_profile_id);
      const { demo_profile_id: _omit, ...rest } = args;
      return handler(rest, { ...ctx, userId: demo.id });
    },
  };
}

// ── Profile fields ─────────────────────────────────────────────────────────

export const USERNAME_RE = /^[a-z0-9_-]{3,30}$/;

// Mirrors RESERVED_TOP_SEGMENTS in src/lib/layout/appShell.ts — a username
// equal to a top-level route would be shadowed by that route.
const RESERVED_USERNAMES = new Set([
  "dashboard", "pricing", "login", "forgot-password", "contact", "cookies",
  "privacy", "terms", "dpa", "acceptable-use", "report", "legal",
  "setup-username", "claim", "mcp", "go", "booking", "hashtag", "auth",
  "sandbox", "space", "api",
]);

export function validateUsername(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("username is required.");
  const u = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(u)) {
    throw new Error("username must be 3–30 chars: lowercase letters, digits, '_' or '-'.");
  }
  if (RESERVED_USERNAMES.has(u)) throw new Error(`username "${u}" is reserved.`);
  return u;
}

const SOCIAL_KEYS = ["instagram", "linkedin", "twitter", "github", "email", "youtube", "whatsapp"] as const;
const BRAND_COLOR_KEYS = ["primary", "accent", "background"] as const;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const profileFieldProps = {
  display_name: { type: "string", description: "Business / display name shown on the profile." },
  tagline: { type: "string", description: "Short one-line tagline under the name." },
  bio: { type: "string", description: "Profile bio (a few sentences)." },
  website_url: { type: "string", format: "uri", description: "Business website (https)." },
  social_links: {
    type: "object",
    description: "Social handles/URLs. Keys: instagram, linkedin, twitter, github, email, youtube, whatsapp.",
    properties: Object.fromEntries(SOCIAL_KEYS.map((k) => [k, { type: "string" }])),
    additionalProperties: false,
  },
  brand_colors: {
    type: "object",
    description: "Brand colors as #RRGGBB hex. Keys: primary, accent, background.",
    properties: Object.fromEntries(BRAND_COLOR_KEYS.map((k) => [k, { type: "string" }])),
    additionalProperties: false,
  },
  brand_description: { type: "string", description: "Short description of the brand / business." },
  avatar_url: {
    type: "string",
    format: "uri",
    description: "https URL of the logo/avatar image to fetch (jpeg/png/webp, ≤5MB).",
  },
} as const;

function optStr(v: unknown, field: string, max: number): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string") throw new Error(`${field} must be a string.`);
  const t = v.trim();
  if (t.length > max) throw new Error(`${field} is too long (max ${max} chars).`);
  return t;
}

// Build a profiles UPDATE patch from tool args. Only known, validated fields.
export function buildProfilePatch(a: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) patch[k] = v; };

  set("display_name", optStr(a.display_name, "display_name", 80));
  set("tagline", optStr(a.tagline, "tagline", 160));
  set("bio", optStr(a.bio, "bio", 2000));
  set("brand_description", optStr(a.brand_description, "brand_description", 2000));

  const site = optStr(a.website_url, "website_url", 500);
  if (site) {
    try {
      const u = new URL(site);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    } catch {
      throw new Error("website_url must be a valid http(s) URL.");
    }
  }
  set("website_url", site);

  if (a.social_links !== undefined) {
    if (a.social_links === null) {
      patch.social_links = null;
    } else if (typeof a.social_links === "object") {
      const out: Record<string, string> = {};
      for (const k of SOCIAL_KEYS) {
        const v = (a.social_links as Record<string, unknown>)[k];
        if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 300);
      }
      patch.social_links = out;
    } else {
      throw new Error("social_links must be an object.");
    }
  }

  if (a.brand_colors !== undefined) {
    if (a.brand_colors === null) {
      patch.brand_colors = null;
    } else if (typeof a.brand_colors === "object") {
      const out: Record<string, string> = {};
      for (const k of BRAND_COLOR_KEYS) {
        const v = (a.brand_colors as Record<string, unknown>)[k];
        if (v === undefined) continue;
        if (typeof v !== "string" || !HEX_RE.test(v)) throw new Error(`brand_colors.${k} must be #RRGGBB.`);
        out[k] = v.toLowerCase();
      }
      patch.brand_colors = out;
    } else {
      throw new Error("brand_colors must be an object.");
    }
  }

  return patch;
}

const AVATAR_MAX = 5 * 1024 * 1024;
const AVATAR_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Upload an avatar for the demo (avatars/<demoId>/avatar.<ext>, upserted —
// same stable-path convention as src/features/profile/storage.ts) and return
// a cache-busted public URL.
export async function uploadDemoAvatar(
  ctx: Ctx,
  demoId: string,
  source: { url?: unknown; file?: OpenAIFileInput },
): Promise<string> {
  let bytes: Uint8Array;
  let contentType: string;
  if (source.file) {
    ({ bytes, contentType } = await resolveFileInput(source.file, AVATAR_MAX));
  } else if (typeof source.url === "string" && source.url) {
    ({ bytes, contentType } = await fetchBytes(source.url, AVATAR_MAX));
  } else {
    throw new Error("No avatar source.");
  }
  contentType = contentType.split(";")[0].trim().toLowerCase();
  const ext = AVATAR_TYPES[contentType];
  if (!ext) throw new Error(`Unsupported avatar type: ${contentType} (use jpeg, png or webp).`);

  const path = `${demoId}/avatar.${ext}`;
  const { error } = await ctx.admin.storage.from("avatars").upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Avatar upload failed: ${error.message}`);
  const { data } = ctx.admin.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

// ── Claim codes ────────────────────────────────────────────────────────────
// Format: NDZ-XXXXX-XXXXX. Alphabet drops confusables (0/O, 1/I/L). The DB
// stores sha256 hex of the NORMALIZED code (uppercase alphanumerics only) —
// claim_demo_profile and nandzz-admin normalize the same way.

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function normalizeClaimCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function generateClaimCode(): { code: string; normalized: string; hint: string } {
  const chars: string[] = [];
  const limit = 256 - (256 % CODE_ALPHABET.length); // rejection sampling → no modulo bias
  while (chars.length < 10) {
    const buf = crypto.getRandomValues(new Uint8Array(16));
    for (const b of buf) {
      if (b < limit && chars.length < 10) chars.push(CODE_ALPHABET[b % CODE_ALPHABET.length]);
    }
  }
  const body = chars.join("");
  const code = `NDZ-${body.slice(0, 5)}-${body.slice(5)}`;
  return { code, normalized: normalizeClaimCode(code), hint: body.slice(-4) };
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function claimUrl(code: string): string {
  return `${PORTAL_ORIGIN}/claim?code=${encodeURIComponent(code)}`;
}
