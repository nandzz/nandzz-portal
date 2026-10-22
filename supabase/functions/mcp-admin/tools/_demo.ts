import type { Ctx, ToolDefinition, ToolHandler, ToolResult } from "../../mcp/tools/types.ts";
import {
  fetchBytes,
  openAIFileParamSchema,
  resolveFileInput,
  type OpenAIFileInput,
} from "../../mcp/tools/_shared.ts";

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

// ── Target guard ───────────────────────────────────────────────────────────
// Every admin tool that writes content takes `demo_profile_id` and must only
// act on a profile flagged is_demo, or on a real account whose owner granted
// support access (profiles.support_access_until in the future, set from
// Settings → Support access). Destructive demo-lifecycle tools (delete, claim
// codes) stay demo-only via requireDemo.

export type TargetProfile = { id: string; username: string; isDemo: boolean };
export type DemoProfile = TargetProfile;

async function loadTarget(ctx: Ctx, id: unknown) {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Error("demo_profile_id is required (UUID from create_demo_profile, list_demo_profiles or find_profile).");
  }
  const { data, error } = await ctx.admin
    .from("profiles")
    .select("id, username, is_demo, support_access_until")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Profile lookup failed: ${error.message}`);
  if (!data) throw new Error(`Profile ${id} not found.`);
  return data as { id: string; username: string; is_demo: boolean; support_access_until: string | null };
}

export function hasSupportAccess(until: string | null | undefined): boolean {
  return !!until && new Date(until).getTime() > Date.now();
}

// Demo profile, or a real account with active owner-granted support access.
export async function requireTarget(ctx: Ctx, id: unknown): Promise<TargetProfile> {
  const row = await loadTarget(ctx, id);
  if (!row.is_demo && !hasSupportAccess(row.support_access_until)) {
    throw new Error(
      `@${row.username} is not a demo profile and its owner hasn't granted support access. ` +
        "Ask them to enable it in Settings → Support access (valid 7 days).",
    );
  }
  return { id: row.id, username: row.username, isDemo: row.is_demo };
}

// Demo profiles only — for tools that delete the account or hand it over.
export async function requireDemo(ctx: Ctx, id: unknown): Promise<TargetProfile> {
  const row = await loadTarget(ctx, id);
  if (!row.is_demo) throw new Error(`Profile ${id} is not a demo profile.`);
  return { id: row.id, username: row.username, isDemo: true };
}

export const demoProfileIdProp = {
  type: "string",
  description:
    "UUID of the profile to act on: a demo profile (create_demo_profile / list_demo_profiles) or a real account " +
    "whose owner granted support access (find_profile by username).",
} as const;

export const demoOnlyIdProp = {
  type: "string",
  description: "UUID of the demo profile (from create_demo_profile or list_demo_profiles).",
} as const;

// Wrap a public-MCP tool so it runs against a target profile: adds a required
// demo_profile_id, verifies the target (requireTarget), then runs the original
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
      description: `${def.description} Acts on the profile given by demo_profile_id (a demo, or a real account with support access).`,
      inputSchema: {
        ...def.inputSchema,
        properties: { demo_profile_id: demoProfileIdProp, ...(schema.properties ?? {}) },
        required: ["demo_profile_id", ...(schema.required ?? [])],
      },
    },
    handler: async (args, ctx) => {
      const demo = await requireTarget(ctx, args.demo_profile_id);
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

// Mirrors BUSINESS_CATEGORIES in src/features/profile/domain/business-category.ts
// and the profiles.category check constraint (migration 20261019120000) — keep
// all three in sync. Restaurants/food are deliberately absent.
export const BUSINESS_CATEGORIES = [
  "hair_salon", "barber", "beauty", "spa_massage", "tattoo_piercing",
  "fitness", "yoga_pilates", "personal_trainer", "medical", "dental",
  "physiotherapy", "psychology", "nutrition", "pet_care", "photography",
  "education", "music_dance", "consulting", "events", "home_services",
  "automotive", "retail", "other",
] as const;

// Mirrors LINK_LAYOUTS in src/lib/gallery/layouts.ts (profiles.links_layout).
export const LINKS_LAYOUTS = ["stack", "pills", "carousel", "grid", "justified", "featured"] as const;

const SOCIAL_KEYS = ["instagram", "linkedin", "twitter", "github", "email", "youtube", "whatsapp"] as const;
const BRAND_COLOR_KEYS = ["primary", "accent", "background"] as const;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const hexProp = (description: string) => ({ type: "string", pattern: "^#[0-9a-fA-F]{6}$", description });

export const profileFieldProps = {
  display_name: { type: "string", description: "Business / display name shown on the profile (max 50)." },
  tagline: { type: "string", description: "Short one-line tagline under the name (max 100)." },
  bio: {
    type: "string",
    description:
      "Profile bio, max 500 chars. Describe the business only — do NOT put the address (use `address`), " +
      "opening hours (configure_booking_widget) or contact handles (use `social_links`) here.",
  },
  category: {
    type: "string",
    enum: BUSINESS_CATEGORIES,
    description:
      "Business category slug — ALWAYS set it (businesses are listed/filtered on the map by category; the profile " +
      "becomes a Business on claim). Pick the closest match; use \"other\" only if nothing fits.",
  },
  website_url: { type: "string", format: "uri", description: "Business website (https)." },
  social_links: {
    type: "object",
    description:
      "Social handles/URLs shown as buttons. Keys: instagram, linkedin, twitter, github, email, youtube, " +
      "whatsapp (E.164, e.g. +393931234567).",
    properties: Object.fromEntries(SOCIAL_KEYS.map((k) => [k, { type: "string" }])),
    additionalProperties: false,
  },
  address: {
    type: "object",
    description:
      "Business address, shown as an address pill under the bio that opens Google Maps. Use this instead of a " +
      "'directions' link. place_id (Google Places) pins the exact place; lat/lng optional.",
    required: ["formatted"],
    properties: {
      formatted: { type: "string", description: "Full address, e.g. 'Via Cardinal Massaia 44, 10147 Torino TO, Italia'." },
      place_id: { type: "string" },
      lat: { type: "number" },
      lng: { type: "number" },
    },
    additionalProperties: false,
  },
  background_color: hexProp(
    "Profile page background (#RRGGBB). Also locks the page to light/dark by its brightness. Pick from the business's brand.",
  ),
  button_color: hexProp("Surface color of the social buttons and address pill (#RRGGBB)."),
  text_color: hexProp("Color of the header texts: name, handle, tagline, bio (#RRGGBB). Must contrast with background_color."),
  booking_button_style: {
    type: "object",
    description: "Look of the 'Book now' button. Omitted keys use the defaults (soft / pill / md / emerald).",
    properties: {
      variant: { type: "string", enum: ["soft", "solid", "outline", "glass"] },
      shape: { type: "string", enum: ["pill", "rounded", "square"] },
      size: { type: "string", enum: ["md", "lg"] },
      color: hexProp("Button color (#RRGGBB), usually the brand primary."),
    },
    additionalProperties: false,
  },
  social_links_style: {
    type: "object",
    description: "Look of the social link buttons.",
    properties: {
      layout: { type: "string", enum: ["icons", "chips", "stack", "minimal"] },
      shape: { type: "string", enum: ["pill", "rounded", "square"] },
      size: { type: "string", enum: ["md", "lg"] },
      tone: { type: "string", enum: ["default", "brand", "filled"] },
    },
    additionalProperties: false,
  },
  brand_colors: {
    type: "object",
    description:
      "Brand colors (#RRGGBB) used in booking emails — NOT the profile page (use background_color / button_color / " +
      "text_color / booking_button_style for that). Keys: primary, accent, background.",
    properties: Object.fromEntries(BRAND_COLOR_KEYS.map((k) => [k, { type: "string" }])),
    additionalProperties: false,
  },
  brand_description: { type: "string", description: "Short description of the brand / business." },
  avatar_url: {
    type: "string",
    format: "uri",
    description:
      "https URL of the profile picture / logo (jpeg/png/webp, ≤5MB) — e.g. the business's Instagram/Google/website " +
      "logo. Square images work best. Very important: a profile without a picture looks unfinished.",
  },
  avatar_file: {
    ...openAIFileParamSchema,
    description: "Profile picture as an uploaded file. Takes precedence over avatar_url.",
  },
  cover_image_url: {
    type: "string",
    format: "uri",
    description: "https URL of a wide cover/background image for the top of the profile (jpeg/png/webp, ≤5MB), e.g. a salon interior photo.",
  },
  show_contents: { type: "boolean", description: "Show the Publications section (default true)." },
  show_gallery: { type: "boolean", description: "Show the Gallery section (default true)." },
  show_links: { type: "boolean", description: "Show the Links section (default true)." },
  links_layout: {
    type: "string",
    enum: LINKS_LAYOUTS,
    description:
      "How the Links section is displayed. 'stack' = full-width button rows, 'pills' = compact wrapping chips " +
      "(both image-less, tinted by button_color — best when links have no preview image); 'carousel' (default), " +
      "'grid', 'justified', 'featured' = image cards.",
  },
} as const;

// Tools that take profileFieldProps advertise avatar_file to the ChatGPT runtime.
export const profileFieldsMeta = { "openai/fileParams": ["avatar_file"] };

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

  // Limits mirror updateProfileInfoSchema so the owner can still edit the
  // values in EditProfileDialog after claiming.
  set("display_name", optStr(a.display_name, "display_name", 50));
  set("tagline", optStr(a.tagline, "tagline", 100));
  set("bio", optStr(a.bio, "bio", 500));
  set("brand_description", optStr(a.brand_description, "brand_description", 2000));

  if (a.category !== undefined) {
    if (a.category === null || a.category === "") patch.category = null;
    else if (typeof a.category === "string" && (BUSINESS_CATEGORIES as readonly string[]).includes(a.category)) {
      patch.category = a.category;
    } else {
      throw new Error(`category must be one of: ${BUSINESS_CATEGORIES.join(", ")}.`);
    }
  }

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

  for (const k of ["background_color", "button_color", "text_color"] as const) {
    const v = a[k];
    if (v === undefined) continue;
    if (v === null || v === "") patch[k] = null;
    else if (typeof v === "string" && HEX_RE.test(v)) patch[k] = v.toLowerCase();
    else throw new Error(`${k} must be #RRGGBB.`);
  }

  if (a.address !== undefined) {
    if (a.address === null) {
      patch.address = null;
    } else if (typeof a.address === "object") {
      const ad = a.address as Record<string, unknown>;
      const formatted = optStr(ad.formatted, "address.formatted", 300);
      if (!formatted) throw new Error("address.formatted is required.");
      const out: Record<string, unknown> = { formatted };
      const placeId = optStr(ad.place_id, "address.place_id", 300);
      if (placeId) out.place_id = placeId;
      if (typeof ad.lat === "number" && typeof ad.lng === "number") {
        if (Math.abs(ad.lat) > 90 || Math.abs(ad.lng) > 180) throw new Error("address lat/lng out of range.");
        out.lat = ad.lat;
        out.lng = ad.lng;
      }
      patch.address = out;
    } else {
      throw new Error("address must be an object with `formatted`.");
    }
  }

  setEnumObject(patch, a, "booking_button_style", {
    variant: ["soft", "solid", "outline", "glass"],
    shape: ["pill", "rounded", "square"],
    size: ["md", "lg"],
  }, { variant: "soft", shape: "pill", size: "md" }, true);
  setEnumObject(patch, a, "social_links_style", {
    layout: ["icons", "chips", "stack", "minimal"],
    shape: ["pill", "rounded", "square"],
    size: ["md", "lg"],
    tone: ["default", "brand", "filled"],
  }, { layout: "icons", shape: "rounded", size: "md", tone: "default" }, false);

  if (a.links_layout !== undefined) {
    if (typeof a.links_layout !== "string" || !(LINKS_LAYOUTS as readonly string[]).includes(a.links_layout)) {
      throw new Error(`links_layout must be one of: ${LINKS_LAYOUTS.join(", ")}.`);
    }
    patch.links_layout = a.links_layout;
  }

  for (const k of ["show_contents", "show_gallery", "show_links"] as const) {
    if (a[k] === undefined) continue;
    if (typeof a[k] !== "boolean") throw new Error(`${k} must be a boolean.`);
    patch[k] = a[k];
  }

  return patch;
}

// Validate a style jsonb ({key: enum, ...} plus optional hex `color`) and fill
// omitted keys with the UI defaults, so the stored shape matches what the
// Style picker writes.
function setEnumObject(
  patch: Record<string, unknown>,
  a: Record<string, unknown>,
  field: string,
  enums: Record<string, readonly string[]>,
  defaults: Record<string, string>,
  withColor: boolean,
): void {
  const v = a[field];
  if (v === undefined) return;
  if (v === null) { patch[field] = null; return; }
  if (typeof v !== "object") throw new Error(`${field} must be an object.`);
  const src = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, allowed] of Object.entries(enums)) {
    const val = src[k] ?? defaults[k];
    if (typeof val !== "string" || !allowed.includes(val)) {
      throw new Error(`${field}.${k} must be one of: ${allowed.join(", ")}.`);
    }
    out[k] = val;
  }
  if (withColor) {
    const c = src.color;
    if (c === undefined || c === null || c === "") out.color = null;
    else if (typeof c === "string" && HEX_RE.test(c)) out.color = c.toLowerCase();
    else throw new Error(`${field}.color must be #RRGGBB.`);
  }
  patch[field] = out;
}

// Resolve avatar_file / avatar_url / cover_image_url args into uploaded public
// URLs on the patch. null clears.
export async function applyProfileImages(
  ctx: Ctx,
  demoId: string,
  a: Record<string, unknown>,
  patch: Record<string, unknown>,
): Promise<void> {
  if (a.avatar_file && typeof a.avatar_file === "object") {
    patch.avatar_url = await uploadDemoAvatar(ctx, demoId, { file: a.avatar_file as OpenAIFileInput });
  } else if (typeof a.avatar_url === "string" && a.avatar_url) {
    patch.avatar_url = await uploadDemoAvatar(ctx, demoId, { url: a.avatar_url });
  } else if (a.avatar_url === null) {
    patch.avatar_url = null;
  }

  if (typeof a.cover_image_url === "string" && a.cover_image_url) {
    patch.background_url = await uploadDemoCover(ctx, demoId, a.cover_image_url);
    patch.background_position = "50% 50%";
  } else if (a.cover_image_url === null) {
    await removeDemoCovers(ctx, demoId);
    patch.background_url = null;
  }
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

// Cover image → profile-backgrounds/<demoId>/background-<ts>.<ext>, same
// convention as uploadBackground in src/features/profile/storage.ts (old files
// removed first so storage doesn't accumulate).
async function removeDemoCovers(ctx: Ctx, demoId: string): Promise<void> {
  const { data } = await ctx.admin.storage.from("profile-backgrounds").list(demoId);
  if (data && data.length > 0) {
    await ctx.admin.storage.from("profile-backgrounds").remove(data.map((f) => `${demoId}/${f.name}`));
  }
}

async function uploadDemoCover(ctx: Ctx, demoId: string, url: string): Promise<string> {
  const fetched = await fetchBytes(url, AVATAR_MAX);
  const contentType = fetched.contentType.split(";")[0].trim().toLowerCase();
  const ext = AVATAR_TYPES[contentType];
  if (!ext) throw new Error(`Unsupported cover type: ${contentType} (use jpeg, png or webp).`);
  await removeDemoCovers(ctx, demoId);
  const path = `${demoId}/background-${Date.now()}.${ext}`;
  const { error } = await ctx.admin.storage
    .from("profile-backgrounds")
    .upload(path, fetched.bytes, { contentType });
  if (error) throw new Error(`Cover upload failed: ${error.message}`);
  return ctx.admin.storage.from("profile-backgrounds").getPublicUrl(path).data.publicUrl;
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
