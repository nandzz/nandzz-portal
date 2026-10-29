import type { Ctx, ToolDefinition, ToolHandler } from "../../mcp/tools/types.ts";
import { demoProfileIdProp, profileUrl, requireTarget, textResult } from "./_demo.ts";

// Booking (calendar) widget setup for demo profiles. The config shape mirrors
// CalendarConfig / Location in the portal (src/lib/types.ts) and is validated
// with the same rules as validateCalendarConfig
// (src/features/booking/domain/calendar.ts) — keep them in sync. Portal readers
// run normalizeCalendarConfig, so keys we don't set (messages, …) fall back to
// their defaults.
//
// Demo profiles get booking access as a demo perk (user_has_entitlement), so no
// plan grant is needed; it ends when the profile is claimed.

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Weekday = typeof WEEKDAYS[number];
type Windows = Partial<Record<Weekday, [string, string][]>>;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WHATSAPP_REMINDER_HOURS = [24, 12, 6, 4];

// ── Input schema ───────────────────────────────────────────────────────────

const windowsSchema = {
  type: "object",
  description:
    'Weekly hours: weekday (mon…sun) → list of ["HH:MM","HH:MM"] windows, 24h, local time. Omit a day = closed. Example: {"mon":[["09:00","13:00"],["14:00","18:00"]]}.',
  properties: Object.fromEntries(
    WEEKDAYS.map((d) => [d, { type: "array", items: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2 } }]),
  ),
  additionalProperties: false,
} as const;

const datesSchema = (desc: string) => ({ type: "array", items: { type: "string" }, description: `${desc} (YYYY-MM-DD).` });

const categoriesSchema = {
  type: "array",
  description: "Optional service groups. Give each an id you then reference from services[].category_id.",
  items: {
    type: "object",
    required: ["id", "name"],
    properties: { id: { type: "string" }, name: { type: "string" } },
    additionalProperties: false,
  },
} as const;

const servicesSchema = {
  type: "array",
  description: "Bookable services.",
  items: {
    type: "object",
    required: ["name", "duration_min"],
    properties: {
      id: { type: "string", description: "Stable id (generated if omitted)." },
      name: { type: "string" },
      duration_min: { type: "integer", minimum: 5, maximum: 1440 },
      price: { type: "number", minimum: 0, description: "Price in major units (e.g. 25.5 = €25.50). Omit for no price." },
      category_id: { type: "string" },
      staff_ids: { type: "array", items: { type: "string" }, description: "Staff who can do it. Omit = anyone." },
      parallel: {
        type: "boolean",
        description: "May run at the same time as other services in a multi-service booking (each by its own staff).",
      },
    },
    additionalProperties: false,
  },
} as const;

const staffSchema = {
  type: "array",
  description: "Optional staff / providers. Each has their own weekly hours (within the business hours).",
  items: {
    type: "object",
    required: ["id", "name"],
    properties: {
      id: { type: "string", description: "Stable id you reference from services[].staff_ids." },
      name: { type: "string" },
      info: { type: "string", description: "Short role / bio." },
      photo_url: { type: "string", format: "uri" },
      availability: windowsSchema,
      blackout_dates: datesSchema("Days off"),
    },
    additionalProperties: false,
  },
} as const;

const locationsSchema = {
  type: "array",
  description:
    "Optional sites / branches. When set, customers first pick a location and EACH location has its own services, staff, " +
    "hours and days off. Omit it for a single-site business: the top-level services/staff/availability are stored as ONE " +
    "location named after the business (the owner dashboard only works with locations), and later top-level edits go to it.",
  items: {
    type: "object",
    required: ["id", "name"],
    properties: {
      id: { type: "string", description: "Stable id, e.g. loc_milan." },
      name: { type: "string" },
      address: { type: "string", description: "Customer-visible address." },
      photo_url: { type: "string", format: "uri" },
      timezone: { type: "string", description: "IANA timezone if different from the business timezone." },
      categories: categoriesSchema,
      services: servicesSchema,
      staff: staffSchema,
      availability: windowsSchema,
      blackout_dates: datesSchema("Closed days"),
    },
    additionalProperties: false,
  },
} as const;

export const configureBookingWidgetDef: ToolDefinition = {
  name: "configure_booking_widget",
  description:
    "Add and configure the booking widget on a profile (demo, or a real account with support access) so its public page shows a working booking calendar: " +
    "services & prices, opening hours, staff, days off, locations/sites, and booking settings. Demo profiles accept real bookings. " +
    "Fields you pass replace the current ones; omitted fields are kept. Booking is included for demos and ends when the profile " +
    "is claimed (unless the owner is granted or buys Pro). On a real account the widget only shows if their plan includes booking.",
  inputSchema: {
    type: "object",
    required: ["demo_profile_id"],
    properties: {
      demo_profile_id: demoProfileIdProp,
      enabled: { type: "boolean", description: "Show the widget on the profile (default true)." },
      timezone: { type: "string", description: "IANA timezone of the business, e.g. Europe/Rome." },
      currency: { type: "string", description: "ISO currency code, e.g. eur, usd, gbp." },
      show_prices: { type: "boolean", description: "Show service prices in the booking flow (default true)." },
      buffer_min: { type: "integer", minimum: 0, maximum: 240, description: "Minutes kept free between bookings." },
      collect_address: { type: "boolean", description: "Ask the customer for an address (home-service businesses)." },
      address_required: { type: "boolean", description: "Make that address mandatory (only with collect_address)." },
      whatsapp_reminder: { type: "boolean", description: "Offer customers a WhatsApp reminder before the appointment (default on)." },
      whatsapp_reminder_hours: { type: "integer", enum: WHATSAPP_REMINDER_HOURS, description: "Reminder lead time in hours." },
      whatsapp_contact_phone: {
        type: "string",
        description: "Business WhatsApp number (E.164, e.g. +393331234567) for the reminder's 'message us' button.",
      },
      categories: categoriesSchema,
      services: servicesSchema,
      staff: staffSchema,
      availability: windowsSchema,
      blackout_dates: datesSchema("Business closed days"),
      locations: locationsSchema,
    },
    additionalProperties: false,
  },
};

export const getBookingWidgetDef: ToolDefinition = {
  name: "get_booking_widget",
  description: "[Demo profile] Show the current booking widget configuration of a demo profile (if any).",
  inputSchema: {
    type: "object",
    required: ["demo_profile_id"],
    properties: { demo_profile_id: demoProfileIdProp },
    additionalProperties: false,
  },
};

// ── Parsing / validation ───────────────────────────────────────────────────

function str(v: unknown, field: string, max = 120): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${field} is required.`);
  return v.trim().slice(0, max);
}

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function parseTimezone(v: unknown, field: string): string {
  const tz = str(v, field, 64);
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch {
    throw new Error(`Unknown timezone "${tz}".`);
  }
  return tz;
}

export function parseWindows(raw: unknown, label: string): Windows {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${label}: must be an object of weekday → windows.`);
  const out: Windows = {};
  for (const [day, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!(WEEKDAYS as readonly string[]).includes(day)) throw new Error(`${label}: unknown weekday "${day}".`);
    if (!Array.isArray(list)) throw new Error(`${label}: ${day} must be a list of [start, end].`);
    const windows: [string, string][] = [];
    for (const w of list) {
      if (!Array.isArray(w) || w.length !== 2) throw new Error(`${label}: ${day} windows must be [start, end].`);
      const [a, b] = w as [unknown, unknown];
      if (typeof a !== "string" || typeof b !== "string" || !TIME_RE.test(a) || !TIME_RE.test(b)) {
        throw new Error(`${label}: invalid time in ${day} (${String(a)}–${String(b)}), use HH:MM.`);
      }
      if (a >= b) throw new Error(`${label}: ${day} start must be before end (${a}–${b}).`);
      windows.push([a, b]);
    }
    if (windows.length) out[day as Weekday] = windows;
  }
  return out;
}

function parseDates(raw: unknown, label: string): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error(`${label} must be a list of YYYY-MM-DD.`);
  return raw.map((d) => {
    if (typeof d !== "string" || !DATE_RE.test(d)) throw new Error(`${label}: invalid date "${String(d)}".`);
    return d;
  });
}

function parseCategories(raw: unknown, p: string) {
  if (!Array.isArray(raw)) throw new Error(`${p}categories must be a list.`);
  const seen = new Set<string>();
  return raw.map((c) => {
    const o = c as Record<string, unknown>;
    const id = str(o.id, `${p}categories[].id`, 64);
    if (seen.has(id)) throw new Error(`${p}duplicate category id "${id}".`);
    seen.add(id);
    return { id, name: str(o.name, `${p}categories[].name`) };
  });
}

function parseStaff(raw: unknown, p: string) {
  if (!Array.isArray(raw)) throw new Error(`${p}staff must be a list.`);
  const seen = new Set<string>();
  return raw.map((s) => {
    const o = s as Record<string, unknown>;
    const id = str(o.id, `${p}staff[].id`, 64);
    if (seen.has(id)) throw new Error(`${p}duplicate staff id "${id}".`);
    seen.add(id);
    const name = str(o.name, `${p}staff[].name`);
    return {
      id,
      name,
      ...(typeof o.info === "string" && o.info.trim() ? { info: o.info.trim().slice(0, 300) } : {}),
      ...(typeof o.photo_url === "string" && o.photo_url.startsWith("https://") ? { photo_url: o.photo_url } : {}),
      availability: parseWindows(o.availability, `${p}Staff "${name}"`),
      ...(o.blackout_dates !== undefined ? { blackout_dates: parseDates(o.blackout_dates, `${p}Staff "${name}" days off`) } : {}),
    };
  });
}

function parseServices(raw: unknown, p: string) {
  if (!Array.isArray(raw)) throw new Error(`${p}services must be a list.`);
  const seen = new Set<string>();
  return raw.map((s) => {
    const o = s as Record<string, unknown>;
    const name = str(o.name, `${p}services[].name`);
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim().slice(0, 64) : genId("svc");
    if (seen.has(id)) throw new Error(`${p}duplicate service id "${id}".`);
    seen.add(id);
    const duration = Number(o.duration_min);
    if (!Number.isInteger(duration) || duration <= 0) throw new Error(`${p}Service "${name}" needs a positive duration_min.`);
    const svc: Record<string, unknown> = { id, name, duration_min: duration };
    if (o.price !== undefined && o.price !== null) {
      const price = Number(o.price);
      if (!Number.isFinite(price) || price < 0) throw new Error(`${p}Service "${name}": invalid price.`);
      svc.price_cents = Math.round(price * 100);
    }
    if (typeof o.category_id === "string" && o.category_id) svc.category_id = o.category_id;
    if (Array.isArray(o.staff_ids) && o.staff_ids.length) svc.staff_ids = o.staff_ids.map(String);
    if (typeof o.parallel === "boolean") svc.parallel = o.parallel;
    return svc;
  });
}

// One "scope" = the services/staff/categories/hours/days-off block that both the
// top level and each location carry. Replaces only the keys present in `a`.
function applyScope(target: Record<string, unknown>, a: Record<string, unknown>, label: string) {
  const p = label ? `${label}: ` : "";
  if (a.categories !== undefined) target.categories = parseCategories(a.categories, p);
  if (a.staff !== undefined) target.staff = parseStaff(a.staff, p);
  if (a.services !== undefined) target.services = parseServices(a.services, p);
  if (a.availability !== undefined) target.availability = parseWindows(a.availability, `${p}Availability`);
  if (a.blackout_dates !== undefined) target.blackout_dates = parseDates(a.blackout_dates, `${p}blackout_dates`);
  checkScopeRefs(target, p);
}

function checkScopeRefs(scope: Record<string, unknown>, p: string) {
  const staffIds = new Set(((scope.staff as { id: string }[] | undefined) ?? []).map((s) => s.id));
  const categoryIds = new Set(((scope.categories as { id: string }[] | undefined) ?? []).map((c) => c.id));
  for (const s of (scope.services as Record<string, unknown>[] | undefined) ?? []) {
    for (const sid of (s.staff_ids as string[] | undefined) ?? []) {
      if (!staffIds.has(sid)) throw new Error(`${p}Service "${s.name}" references unknown staff id "${sid}".`);
    }
    if (s.category_id && !categoryIds.has(s.category_id as string)) {
      throw new Error(`${p}Service "${s.name}" references unknown category id "${s.category_id}".`);
    }
  }
}

function parseLocations(raw: unknown, existing: Record<string, unknown>[]): Record<string, unknown>[] {
  if (!Array.isArray(raw)) throw new Error("locations must be a list.");
  const byId = new Map(existing.map((l) => [String(l.id), l]));
  const seen = new Set<string>();
  return raw.map((l) => {
    const o = l as Record<string, unknown>;
    const id = str(o.id, "locations[].id", 64);
    if (seen.has(id)) throw new Error(`Duplicate location id "${id}".`);
    seen.add(id);
    const name = str(o.name, "locations[].name");
    const label = `Location "${name}"`;
    // Same id ⇒ merge over the stored location (omitted nested fields kept).
    const loc: Record<string, unknown> = {
      services: [],
      categories: [],
      staff: [],
      availability: {},
      ...(byId.get(id) ?? {}),
      id,
      name,
    };
    if (o.address !== undefined) loc.address = typeof o.address === "string" && o.address.trim() ? o.address.trim().slice(0, 300) : undefined;
    if (o.photo_url !== undefined) loc.photo_url = typeof o.photo_url === "string" && o.photo_url.startsWith("https://") ? o.photo_url : undefined;
    if (o.timezone !== undefined) loc.timezone = parseTimezone(o.timezone, `${label} timezone`);
    applyScope(loc, o, label);
    return loc;
  });
}

// Merge tool args over the existing config, validating every replaced field.
export function buildCalendarConfig(
  existing: Record<string, unknown>,
  a: Record<string, unknown>,
  site: SiteInfo = { name: "Main location" },
): Record<string, unknown> {
  const cfg: Record<string, unknown> = { ...existing };

  if (a.timezone !== undefined) cfg.timezone = parseTimezone(a.timezone, "timezone");
  if (a.currency !== undefined) {
    const cur = str(a.currency, "currency", 3).toLowerCase();
    if (!/^[a-z]{3}$/.test(cur)) throw new Error("currency must be a 3-letter ISO code.");
    cfg.currency = cur;
  }
  for (const k of ["show_prices", "collect_address", "address_required", "whatsapp_reminder"] as const) {
    if (typeof a[k] === "boolean") cfg[k] = a[k];
  }
  if (a.buffer_min !== undefined) {
    const b = Number(a.buffer_min);
    if (!Number.isInteger(b) || b < 0) throw new Error("buffer_min must be a non-negative integer.");
    cfg.buffer_min = b;
  }
  if (a.whatsapp_reminder_hours !== undefined) {
    const h = Number(a.whatsapp_reminder_hours);
    if (!WHATSAPP_REMINDER_HOURS.includes(h)) throw new Error(`whatsapp_reminder_hours must be one of ${WHATSAPP_REMINDER_HOURS.join(", ")}.`);
    cfg.whatsapp_reminder_hours = h;
  }
  if (a.whatsapp_contact_phone !== undefined) {
    const phone = typeof a.whatsapp_contact_phone === "string" ? a.whatsapp_contact_phone.replace(/[\s()-]/g, "") : "";
    if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) throw new Error("whatsapp_contact_phone must be E.164, e.g. +393331234567.");
    cfg.whatsapp_contact_phone = phone;
  }

  // Top-level scope args (services/staff/hours…) target the business itself:
  // with a single location that IS the business, so they edit it; with
  // several, they're ambiguous and must go inside `locations`.
  const current = (cfg.locations as Record<string, unknown>[] | undefined) ?? [];
  const hasScopeArgs = SCOPE_KEYS.some((k) => a[k] !== undefined);
  if (a.locations === undefined && current.length === 1) {
    const loc = { ...current[0] };
    applyScope(loc, a, `Location "${loc.name}"`);
    cfg.locations = [loc];
  } else if (a.locations === undefined && current.length > 1 && hasScopeArgs) {
    throw new Error(`This widget has ${current.length} locations — pass services/staff/hours inside \`locations\`.`);
  } else {
    applyScope(cfg, a, "");
  }

  if (a.locations !== undefined) {
    cfg.locations = parseLocations(a.locations, current);
  }

  wrapSingleSite(cfg, site);

  if (!cfg.timezone) throw new Error("timezone is required for a new booking widget (e.g. Europe/Rome).");
  return cfg;
}

const SCOPE_KEYS = ["categories", "staff", "services", "availability", "blackout_dates"] as const;

export type SiteInfo = { name: string; address?: string };

// The owner dashboard only opens a location — a config with services but no
// locations ("legacy" top-level scope) books fine publicly yet shows the owner
// an empty "add a location" screen. So a single-site setup is always stored as
// ONE location holding the top-level scope, which is then cleared.
// Mirrors supabase/migrations/20261029120000_booking_wrap_legacy_location.sql.
function wrapSingleSite(cfg: Record<string, unknown>, site: SiteInfo) {
  const locs = (cfg.locations as unknown[] | undefined) ?? [];
  const services = (cfg.services as unknown[] | undefined) ?? [];
  const staff = (cfg.staff as unknown[] | undefined) ?? [];
  if (locs.length || (!services.length && !staff.length)) return;
  cfg.locations = [
    {
      id: "loc_main",
      name: site.name,
      ...(site.address ? { address: site.address } : {}),
      services,
      categories: cfg.categories ?? [],
      staff,
      availability: cfg.availability ?? {},
      blackout_dates: cfg.blackout_dates ?? [],
    },
  ];
  cfg.services = [];
  cfg.categories = [];
  cfg.staff = [];
  cfg.availability = {};
  cfg.blackout_dates = [];
}

// Total bookable services across the active mode (locations ⇒ per-location).
export function serviceCount(cfg: Record<string, unknown>): number {
  const locs = (cfg.locations as Record<string, unknown>[] | undefined) ?? [];
  if (locs.length) return locs.reduce((n, l) => n + ((l.services as unknown[] | undefined) ?? []).length, 0);
  return ((cfg.services as unknown[] | undefined) ?? []).length;
}

// ── Handlers ───────────────────────────────────────────────────────────────

async function calendarCatalogId(ctx: Ctx): Promise<string> {
  const { data, error } = await ctx.admin.from("widget_catalog").select("id, active").eq("slug", "calendar").maybeSingle();
  if (error) throw new Error(`Widget catalog lookup failed: ${error.message}`);
  const row = data as { id: string; active: boolean } | null;
  if (!row?.active) throw new Error("The booking widget is not available in the catalog.");
  return row.id;
}

export const configureBookingWidget: ToolHandler = async (args, ctx) => {
  const demo = await requireTarget(ctx, args.demo_profile_id);
  const catalogId = await calendarCatalogId(ctx);

  const { data: existing, error: exErr } = await ctx.admin
    .from("widget_instances")
    .select("id, config")
    .eq("user_id", demo.id)
    .eq("catalog_id", catalogId)
    .maybeSingle();
  if (exErr) throw new Error(`Widget lookup failed: ${exErr.message}`);
  const ex = existing as { id: string; config: Record<string, unknown> | null } | null;

  // Seed defaults for a new widget the same way createWidgetInstance does.
  const base: Record<string, unknown> = ex?.config ?? {
    currency: "eur",
    buffer_min: 0,
    show_prices: true,
    collect_address: false,
    address_required: false,
    whatsapp_reminder: true,
    whatsapp_reminder_hours: 4,
    whatsapp_contact_phone: "",
    services: [],
    categories: [],
    staff: [],
    locations: [],
    blackout_dates: [],
    availability: { mon: [["09:00", "17:00"]], tue: [["09:00", "17:00"]], wed: [["09:00", "17:00"]], thu: [["09:00", "17:00"]], fri: [["09:00", "17:00"]] },
  };
  const { data: prof } = await ctx.admin.from("profiles").select("display_name, address").eq("id", demo.id).maybeSingle();
  const p = prof as { display_name: string | null; address: { formatted?: string } | null } | null;
  const config = buildCalendarConfig(base, args, {
    name: (p?.display_name ?? "").trim().slice(0, 80) || demo.username,
    address: p?.address?.formatted?.trim().slice(0, 300) || undefined,
  });
  const services = serviceCount(config);
  const enabled = typeof args.enabled === "boolean" ? args.enabled : true;
  if (enabled && services === 0) {
    throw new Error("Add at least one service before enabling the booking widget.");
  }

  if (ex) {
    const { error } = await ctx.admin.from("widget_instances").update({ config, enabled }).eq("id", ex.id).eq("user_id", demo.id);
    if (error) throw new Error(`Widget update failed: ${error.message}`);
  } else {
    const { error } = await ctx.admin
      .from("widget_instances")
      .insert({ user_id: demo.id, catalog_id: catalogId, config, enabled });
    if (error) throw new Error(`Widget create failed: ${error.message}`);
  }

  // Real accounts need the widgets entitlement (plan or grant) for the widget
  // to render; demos always have it.
  let accessNote = "Booking is included while this is a demo; after claim it needs Pro (or an admin grant).";
  if (!demo.isDemo) {
    const { data: entitled } = await ctx.admin.rpc("user_has_entitlement", {
      p_user_id: demo.id,
      p_entitlement: "widgets",
    });
    accessNote = entitled
      ? "Their plan includes booking, so the widget is live."
      : "WARNING: their plan doesn't include booking — the widget stays hidden until they upgrade to Pro or an admin grants it.";
  }

  const locs = ((config.locations as unknown[] | undefined) ?? []).length;
  const staffCount = ((config.staff as unknown[] | undefined) ?? []).length;
  return textResult(
    `${ex ? "Updated" : "Added"} the booking widget on @${demo.username} (${enabled ? "visible, accepting bookings" : "hidden"}): ` +
      `${services} service(s)` +
      (locs ? ` across ${locs} location(s)` : `, ${staffCount} staff`) +
      `, timezone ${config.timezone}.\n` +
      `${accessNote}\n` +
      `Profile: ${profileUrl(demo.username)}`,
    { demo_profile_id: demo.id, enabled, config },
  );
};

export const getBookingWidget: ToolHandler = async (args, ctx) => {
  const demo = await requireTarget(ctx, args.demo_profile_id);
  const catalogId = await calendarCatalogId(ctx);
  const { data } = await ctx.admin
    .from("widget_instances")
    .select("id, enabled, config")
    .eq("user_id", demo.id)
    .eq("catalog_id", catalogId)
    .maybeSingle();
  if (!data) return textResult(`@${demo.username} has no booking widget yet. Use configure_booking_widget.`, { widget: null });
  const w = data as { id: string; enabled: boolean; config: Record<string, unknown> };
  return textResult(
    `Booking widget on @${demo.username} (${w.enabled ? "visible" : "hidden"}):\n${JSON.stringify(w.config, null, 2)}`,
    { widget: w },
  );
};
