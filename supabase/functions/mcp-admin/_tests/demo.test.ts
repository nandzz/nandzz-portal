import {
  assert,
  assertEquals,
  assertMatch,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { makeCtx } from "../../mcp/_tests/fakes.ts";
import type { ToolHandler } from "../../mcp/tools/types.ts";
import {
  BUSINESS_CATEGORIES,
  buildProfilePatch,
  generateClaimCode,
  normalizeClaimCode,
  onDemo,
  requireDemo,
  sha256Hex,
  validateUsername,
} from "../tools/_demo.ts";
import { toolDefinitions, toolHandlers } from "../registry.ts";

const DEMO_ID = "11111111-2222-3333-4444-555555555555";

const echo: ToolHandler = (args, ctx) =>
  Promise.resolve({ content: [{ type: "text", text: ctx.userId }], structuredContent: { args } });

const def = { name: "x", description: "d", inputSchema: { type: "object", properties: { a: {} }, required: ["a"] } };

Deno.test("onDemo: runs the handler as the demo profile and strips demo_profile_id", async () => {
  const { ctx } = makeCtx({
    from: { profiles: { select: { data: { id: DEMO_ID, username: "demo", is_demo: true }, error: null } } },
  });
  const t = onDemo(def, echo);
  const res = await t.handler({ demo_profile_id: DEMO_ID, a: 1 }, ctx);
  assertEquals(res.content[0].text, DEMO_ID);
  assertEquals(res.structuredContent?.args, { a: 1 });
  assertEquals((t.def.inputSchema as { required: string[] }).required, ["demo_profile_id", "a"]);
});

Deno.test("onDemo: refuses a real account without support access", async () => {
  const { ctx } = makeCtx({
    from: { profiles: { select: { data: { id: DEMO_ID, username: "real", is_demo: false, support_access_until: null }, error: null } } },
  });
  await assertRejects(() => onDemo(def, echo).handler({ demo_profile_id: DEMO_ID, a: 1 }, ctx), Error, "support access");
});

Deno.test("onDemo: refuses a real account whose support access expired", async () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const { ctx } = makeCtx({
    from: { profiles: { select: { data: { id: DEMO_ID, username: "real", is_demo: false, support_access_until: past }, error: null } } },
  });
  await assertRejects(() => onDemo(def, echo).handler({ demo_profile_id: DEMO_ID, a: 1 }, ctx), Error, "support access");
});

Deno.test("onDemo: runs on a real account with active support access", async () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const { ctx } = makeCtx({
    from: { profiles: { select: { data: { id: DEMO_ID, username: "real", is_demo: false, support_access_until: future }, error: null } } },
  });
  const res = await onDemo(def, echo).handler({ demo_profile_id: DEMO_ID, a: 1 }, ctx);
  assertEquals(res.content[0].text, DEMO_ID);
});

Deno.test("requireDemo: refuses a real account even with support access", async () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const { ctx } = makeCtx({
    from: { profiles: { select: { data: { id: DEMO_ID, username: "real", is_demo: false, support_access_until: future }, error: null } } },
  });
  await assertRejects(() => requireDemo(ctx, DEMO_ID), Error, "not a demo");
});

Deno.test("onDemo: refuses a missing / malformed demo_profile_id", async () => {
  const { ctx } = makeCtx();
  await assertRejects(() => onDemo(def, echo).handler({ a: 1 }, ctx), Error, "demo_profile_id is required");
});

Deno.test("registry: every reused content tool requires demo_profile_id; no booking tools", () => {
  for (const d of toolDefinitions) {
    assert(toolHandlers[d.name], `missing handler for ${d.name}`);
    if (["create_demo_profile", "list_demo_profiles", "find_profile"].includes(d.name)) continue;
    const req = (d.inputSchema as { required?: string[] }).required ?? [];
    assert(req.includes("demo_profile_id"), `${d.name} must require demo_profile_id`);
  }
  assert(!toolHandlers.book_appointment && !toolHandlers.list_availability);
});

Deno.test("claim code: format, alphabet, normalized hash", async () => {
  const { code, normalized, hint } = generateClaimCode();
  assertMatch(code, /^NDZ-[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
  assertEquals(normalized, code.replace(/-/g, ""));
  assertEquals(hint, normalized.slice(-4));
  assertEquals(normalizeClaimCode(` ${code.toLowerCase()} `), normalized);
  assertEquals(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

Deno.test("validateUsername: lowercases, rejects bad + reserved", () => {
  assertEquals(validateUsername(" Cafe-Roma "), "cafe-roma");
  assertThrows(() => validateUsername("ab"));
  assertThrows(() => validateUsername("bad name"));
  assertThrows(() => validateUsername("claim"), Error, "reserved");
});

Deno.test("buildProfilePatch: whitelists + validates fields", () => {
  const p = buildProfilePatch({
    display_name: " Roma ",
    social_links: { instagram: "@roma", bogus: "x" },
    brand_colors: { primary: "#AABBCC" },
    is_admin: true,
  });
  assertEquals(p, { display_name: "Roma", social_links: { instagram: "@roma" }, brand_colors: { primary: "#aabbcc" } });
  assertThrows(() => buildProfilePatch({ brand_colors: { primary: "red" } }));
  assertThrows(() => buildProfilePatch({ website_url: "javascript:alert(1)" }));
});

import { buildCalendarConfig, parseWindows, serviceCount } from "../tools/booking_widget.ts";

Deno.test("buildCalendarConfig: converts prices, generates ids, merges over existing", () => {
  const cfg = buildCalendarConfig(
    { currency: "eur", availability: { mon: [["09:00", "17:00"]] }, staff: [] },
    {
      timezone: "Europe/Rome",
      services: [{ name: "Haircut", duration_min: 30, price: 25.5 }],
      staff: [{ id: "anna", name: "Anna", availability: { tue: [["10:00", "14:00"]] } }],
    },
  );
  const svc = (cfg.services as Record<string, unknown>[])[0];
  assertEquals(svc.price_cents, 2550);
  assertMatch(String(svc.id), /^svc_/);
  assertEquals(cfg.currency, "eur");
  assertEquals(cfg.availability, { mon: [["09:00", "17:00"]] });
  assertEquals(cfg.timezone, "Europe/Rome");
});

Deno.test("buildCalendarConfig: rejects bad timezone, unknown staff ref, bad windows", () => {
  assertThrows(() => buildCalendarConfig({}, { timezone: "Mars/Base" }), Error, "Unknown timezone");
  assertThrows(
    () => buildCalendarConfig({ timezone: "UTC" }, { services: [{ name: "X", duration_min: 30, staff_ids: ["ghost"] }] }),
    Error,
    "unknown staff",
  );
  assertThrows(() => parseWindows({ mon: [["18:00", "09:00"]] }, "A"), Error, "before end");
  assertThrows(() => parseWindows({ funday: [] }, "A"), Error, "unknown weekday");
  assertThrows(() => buildCalendarConfig({}, {}), Error, "timezone is required");
});

Deno.test("buildCalendarConfig: locations carry their own validated services/staff and merge by id", () => {
  const first = buildCalendarConfig({ timezone: "Europe/Rome" }, {
    locations: [
      {
        id: "loc_milan",
        name: "Milan",
        address: "Via Roma 1",
        staff: [{ id: "anna", name: "Anna" }],
        services: [{ name: "Cut", duration_min: 30, staff_ids: ["anna"] }],
        availability: { sat: [["09:00", "13:00"]] },
      },
      { id: "loc_rome", name: "Rome", timezone: "Europe/Rome", services: [{ name: "Color", duration_min: 90, price: 60 }] },
    ],
  });
  assertEquals(serviceCount(first), 2);
  // Re-sending a location by id with only new hours keeps its services.
  const second = buildCalendarConfig(first, { locations: [{ id: "loc_milan", name: "Milan", availability: { mon: [["10:00", "12:00"]] } }] });
  const milan = (second.locations as Record<string, unknown>[])[0];
  assertEquals((milan.services as unknown[]).length, 1);
  assertEquals(milan.availability, { mon: [["10:00", "12:00"]] });
  assertThrows(
    () => buildCalendarConfig({ timezone: "UTC" }, { locations: [{ id: "x", name: "X", services: [{ name: "S", duration_min: 10, staff_ids: ["nobody"] }] }] }),
    Error,
    'Location "X"',
  );
});

Deno.test("buildCalendarConfig: booking settings validated", () => {
  const cfg = buildCalendarConfig({ timezone: "UTC" }, { whatsapp_reminder_hours: 24, whatsapp_contact_phone: "+39 333 123 4567", address_required: true });
  assertEquals(cfg.whatsapp_reminder_hours, 24);
  assertEquals(cfg.whatsapp_contact_phone, "+393331234567");
  assertThrows(() => buildCalendarConfig({ timezone: "UTC" }, { whatsapp_reminder_hours: 5 }));
  assertThrows(() => buildCalendarConfig({ timezone: "UTC" }, { whatsapp_contact_phone: "12345" }));
});

Deno.test("buildProfilePatch: address, page colors, styles, section flags", () => {
  const p = buildProfilePatch({
    address: { formatted: " Via Roma 1, Torino ", lat: 45, lng: 7.6, extra: "x" },
    background_color: "#1A0B2E",
    text_color: null,
    booking_button_style: { variant: "solid", color: "#C026D3" },
    social_links_style: { tone: "brand" },
    show_gallery: false,
    links_layout: "stack",
  });
  assertEquals(p.address, { formatted: "Via Roma 1, Torino", lat: 45, lng: 7.6 });
  assertEquals(p.background_color, "#1a0b2e");
  assertEquals(p.text_color, null);
  assertEquals(p.booking_button_style, { variant: "solid", shape: "pill", size: "md", color: "#c026d3" });
  assertEquals(p.social_links_style, { layout: "icons", shape: "rounded", size: "md", tone: "brand" });
  assertEquals(p.show_gallery, false);
  assertEquals(p.links_layout, "stack");
  assertThrows(() => buildProfilePatch({ links_layout: "masonry" }));
  assertThrows(() => buildProfilePatch({ address: { place_id: "x" } }));
  assertThrows(() => buildProfilePatch({ button_color: "#fff" }));
  assertThrows(() => buildProfilePatch({ booking_button_style: { variant: "neon" } }));
  assertThrows(() => buildProfilePatch({ bio: "x".repeat(501) }));
});

Deno.test("buildProfilePatch: category validated against the business category list", () => {
  assertEquals(buildProfilePatch({ category: "barber" }), { category: "barber" });
  assertEquals(buildProfilePatch({ category: null }), { category: null });
  assertThrows(() => buildProfilePatch({ category: "restaurant" }), Error, "category must be one of");
  assertThrows(() => buildProfilePatch({ category: 3 }), Error, "category must be one of");
});

Deno.test("BUSINESS_CATEGORIES mirrors the app list and the DB check constraint", async () => {
  const root = new URL("../../../../", import.meta.url);
  const app = await Deno.readTextFile(new URL("src/features/profile/domain/business-category.ts", root));
  const appList = app.match(/BUSINESS_CATEGORIES = \[([\s\S]*?)\]/)![1].match(/"([a-z_]+)"/g)!.map((s) => s.slice(1, -1));
  const sql = await Deno.readTextFile(new URL("supabase/migrations/20261019120000_profile_business_category.sql", root));
  const dbList = sql.match(/category in \(([\s\S]*?)\)/)![1].match(/'([a-z_]+)'/g)!.map((s) => s.slice(1, -1));
  assertEquals([...BUSINESS_CATEGORIES], appList);
  assertEquals([...BUSINESS_CATEGORIES], dbList);
});

Deno.test("create/update_demo_profile expose category as an enum", () => {
  for (const name of ["create_demo_profile", "update_demo_profile"]) {
    const d = toolDefinitions.find((t) => t.name === name)!;
    const props = (d.inputSchema as { properties: Record<string, { enum?: readonly string[] }> }).properties;
    assertEquals(props.category.enum, BUSINESS_CATEGORIES);
  }
});
