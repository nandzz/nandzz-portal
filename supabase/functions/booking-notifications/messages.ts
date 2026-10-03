// Owner-customizable template logic — ported from src/lib/widgets/messages.ts
// and the `bookingMessageVars` helper in src/lib/widgets/notify.ts to Deno.
// Extended for the per-locale (`i18n`) overrides and the two new template kinds
// (reschedule, reminder). Backward compatible: existing configs with only
// confirmation/cancellation and no i18n still normalize to a valid shape.

import { formatBookingTimeRelative } from "./emails.ts";
import type {
  CalendarMessages,
  Locale,
  MessageChannel,
  MessageTemplate,
} from "./types.ts";

// Kept in sync with WIDGET_CURRENCIES in the app (src/lib/widgets/messages.ts).
const CURRENCY_SYMBOLS: Record<string, string> = {
  eur: "€",
  usd: "$",
  gbp: "£",
  chf: "CHF",
  jpy: "¥",
  brl: "R$",
  cad: "CA$",
  aud: "A$",
  mxn: "MX$",
  sek: "kr",
  pln: "zł",
  inr: "₹",
};

export function currencySymbol(code: string | null | undefined): string {
  if (!code) return CURRENCY_SYMBOLS.eur;
  return CURRENCY_SYMBOLS[code.toLowerCase()] ?? code.toUpperCase();
}

export function defaultCalendarMessages(): CalendarMessages {
  return {
    confirmation: {
      channel: "both",
      subject: "Booking confirmed — {{service}} with {{business}}",
      body:
        "Hi {{customer_first_name}}, your booking with {{business}} is confirmed ✅\n\n" +
        "*{{service}}*\n🗓️ {{date_time}}\n\n" +
        "Manage or reschedule: {{manage_url}}",
    },
    cancellation: {
      channel: "both",
      subject: "Booking cancelled — {{service}} with {{business}}",
      body:
        "Hi {{customer_first_name}}, your {{service}} booking with {{business}} on " +
        "{{date_time}} has been cancelled.\n\nHope to see you again soon.",
    },
    reschedule: {
      channel: "both",
      subject: "Booking rescheduled — {{service}} with {{business}}",
      body:
        "Hi {{customer_first_name}}, your {{service}} booking with {{business}} has been " +
        "rescheduled.\n\n🗓️ New time: {{date_time}}\n\nManage: {{manage_url}}",
    },
    reminder: {
      channel: "both",
      subject: "Reminder — {{service}} with {{business}} tomorrow",
      body:
        "Hi {{customer_first_name}}, a reminder for your upcoming booking with {{business}}.\n\n" +
        "*{{service}}*\n🗓️ {{date_time}}\n\nManage or reschedule: {{manage_url}}",
    },
  };
}

const CHANNELS: MessageChannel[] = ["off", "whatsapp", "email", "both"];
const LOCALES: Locale[] = ["en", "pt", "fr", "es", "ja", "de", "it"];

function normalizeI18n(
  raw: unknown,
): MessageTemplate["i18n"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: NonNullable<MessageTemplate["i18n"]> = {};
  for (const loc of LOCALES) {
    const entry = (raw as Record<string, unknown>)[loc];
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { subject?: unknown; body?: unknown };
    const norm: { subject?: string; body?: string } = {};
    if (typeof e.subject === "string") norm.subject = e.subject;
    if (typeof e.body === "string") norm.body = e.body;
    if (norm.subject !== undefined || norm.body !== undefined) out[loc] = norm;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeTemplate(raw: unknown, fallback: MessageTemplate): MessageTemplate {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const t = raw as Partial<MessageTemplate>;
  const tpl: MessageTemplate = {
    channel: CHANNELS.includes(t.channel as MessageChannel)
      ? (t.channel as MessageChannel)
      : fallback.channel,
    subject: typeof t.subject === "string" ? t.subject : fallback.subject,
    body: typeof t.body === "string" ? t.body : fallback.body,
  };
  const i18n = normalizeI18n((raw as { i18n?: unknown }).i18n);
  if (i18n) tpl.i18n = i18n;
  return tpl;
}

// Fill in any missing template (including the two new kinds) so downstream code
// can trust the shape. Existing configs without reschedule/reminder/i18n work.
export function normalizeCalendarMessages(raw: unknown): CalendarMessages {
  const base = defaultCalendarMessages();
  if (!raw || typeof raw !== "object") return base;
  const m = raw as Partial<CalendarMessages>;
  return {
    confirmation: normalizeTemplate(m.confirmation, base.confirmation),
    cancellation: normalizeTemplate(m.cancellation, base.cancellation),
    reschedule: normalizeTemplate(m.reschedule, base.reschedule),
    reminder: normalizeTemplate(m.reminder, base.reminder),
  };
}

// For locale L, use i18n[L].subject/body if present, else the top-level field.
export function localizedTemplate(
  tpl: MessageTemplate,
  locale: Locale,
): { subject: string; body: string } {
  const override = tpl.i18n?.[locale];
  return {
    subject: override?.subject ?? tpl.subject,
    body: override?.body ?? tpl.body,
  };
}

// Substitute {{variables}} and resolve {{#key}}…{{/key}} conditional sections.
// Sections are stripped when their variable is missing/empty (so optional rows
// like staff or price disappear entirely, labels and all) and kept otherwise;
// this runs first so the surrounding markup is gone before substitution. Known
// keys are replaced (missing → empty string); unknown placeholders are left
// untouched so typos stay visible to the owner.
export function renderTemplate(template: string, vars: Record<string, string>): string {
  const withSections = template.replace(
    /\{\{#\s*(\w+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g,
    (_match, key: string, inner: string) =>
      vars[key] != null && String(vars[key]).trim() !== "" ? inner : "",
  );
  return withSections.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in vars ? vars[key] ?? "" : match,
  );
}

// One booked service and who performs it (null staff ⇒ unstaffed / unknown).
export type BookingServiceLine = { name: string; staffName: string | null };

export type BookingMessageContext = {
  customerName: string;
  businessName: string;
  serviceName: string;
  staffName: string | null;
  // Every booked service in order (always >= 1; a single-service booking is one line).
  services: BookingServiceLine[];
  startsAt: string;
  timezone: string;
  priceCents: number | null;
  currencySymbol: string;
  manageUrl: string;
};

// "Haircut (Ana), Colour (Bea)" — plain-text services list for subjects/text.
export function servicesText(services: BookingServiceLine[]): string {
  return services
    .map((s) => (s.staffName ? `${s.name} (${s.staffName})` : s.name))
    .join(", ");
}

// Distinct staff names across the services, in order of first appearance.
function distinctStaff(ctx: BookingMessageContext): string[] {
  const names = ctx.services.map((s) => s.staffName).filter((n): n is string => !!n);
  if (names.length === 0 && ctx.staffName) names.push(ctx.staffName);
  return [...new Set(names)];
}

// Build the {{variable}} map for a template render, localizing the date string.
// {{services}} here is the plain-text list; the HTML render overrides it with
// markup rows (see render.ts). {{multi_service}}/{{single_service}} are section
// flags ("1" or "") so templates can pick a singular/plural label.
export function bookingMessageVars(
  ctx: BookingMessageContext,
  locale: Locale,
): Record<string, string> {
  const firstName = ctx.customerName.split(" ")[0] || ctx.customerName;
  const price =
    ctx.priceCents != null && ctx.priceCents > 0
      ? `${ctx.currencySymbol}${(ctx.priceCents / 100).toLocaleString(undefined, {
          minimumFractionDigits: ctx.priceCents % 100 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        })}`
      : "";
  return {
    customer_name: ctx.customerName,
    customer_first_name: firstName,
    service: ctx.serviceName,
    staff: distinctStaff(ctx).join(", "),
    services: servicesText(ctx.services),
    multi_service: ctx.services.length > 1 ? "1" : "",
    single_service: ctx.services.length > 1 ? "" : "1",
    date_time: formatBookingTimeRelative(ctx.startsAt, ctx.timezone, locale),
    business: ctx.businessName,
    price,
    manage_url: ctx.manageUrl,
  };
}
