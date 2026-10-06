// Owner-customizable message templates for the calendar widget: the variable
// catalog, defaults, normalization, and rendering. Pure — safe on client and
// server. Server-side dispatch (actually sending) lives in `notify.ts`.

import type { CalendarMessages, MessageChannel, MessageTemplate } from "@/lib/types";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/translations";

// The placeholders an owner can drop into a template. `{{key}}` (whitespace
// tolerated) is substituted at send time; unknown placeholders are left as-is.
export const MESSAGE_VARIABLES: { key: string; label: string; sample: string }[] = [
  { key: "customer_name", label: "Customer name", sample: "Jamie Rivera" },
  { key: "customer_first_name", label: "Customer first name", sample: "Jamie" },
  { key: "service", label: "Service", sample: "Consultation" },
  { key: "staff", label: "Staff member", sample: "Alex Kim" },
  { key: "date_time", label: "Date & time", sample: "Mon, Aug 4, 2:00 PM" },
  { key: "business", label: "Business name", sample: "Acme Studio" },
  { key: "price", label: "Price", sample: "$40" },
  { key: "manage_url", label: "Manage link", sample: "https://nandzz.com/booking/abc" },
];

export const MESSAGE_CHANNELS: { value: MessageChannel; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "both", label: "Both" },
];

// The currencies an owner can pick for their booking widget. `symbol` is what the
// public widget and dashboard render next to prices; the code is what we store in
// the calendar config (`config.currency`). Kept small and curated so the selector
// stays scannable — extend as needed.
export const WIDGET_CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: "eur", symbol: "€", label: "Euro" },
  { code: "usd", symbol: "$", label: "US Dollar" },
  { code: "gbp", symbol: "£", label: "British Pound" },
  { code: "chf", symbol: "CHF", label: "Swiss Franc" },
  { code: "jpy", symbol: "¥", label: "Japanese Yen" },
  { code: "brl", symbol: "R$", label: "Brazilian Real" },
  { code: "cad", symbol: "CA$", label: "Canadian Dollar" },
  { code: "aud", symbol: "A$", label: "Australian Dollar" },
  { code: "mxn", symbol: "MX$", label: "Mexican Peso" },
  { code: "sek", symbol: "kr", label: "Swedish Krona" },
  { code: "pln", symbol: "zł", label: "Polish Złoty" },
  { code: "inr", symbol: "₹", label: "Indian Rupee" },
];

const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  WIDGET_CURRENCIES.map((c) => [c.code, c.symbol])
);

// The platform's baseline currency — used when a widget's config predates the
// currency field (legacy widgets stored none). Matches the historical catalog
// default (EUR).
export const DEFAULT_WIDGET_CURRENCY = "eur";

export function currencySymbol(code: string | null | undefined): string {
  if (!code) return CURRENCY_SYMBOLS[DEFAULT_WIDGET_CURRENCY];
  return CURRENCY_SYMBOLS[code.toLowerCase()] ?? code.toUpperCase();
}

// Best-guess currency for a locale, used as the default when the owner first
// configures a widget. Falls back to the platform default (EUR) for locales we
// don't map — the owner can always override in the selector.
const LOCALE_CURRENCY: Record<string, string> = {
  en: "usd",
  ja: "jpy",
  it: "eur",
  de: "eur",
  fr: "eur",
  es: "eur",
  pt: "eur",
};

export function suggestedCurrencyForLocale(locale: string | null | undefined): string {
  if (!locale) return DEFAULT_WIDGET_CURRENCY;
  const base = locale.toLowerCase().split("-")[0];
  return LOCALE_CURRENCY[base] ?? DEFAULT_WIDGET_CURRENCY;
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
        "rescheduled 🗓️\n\nNew time: *{{date_time}}*\n\n" +
        "Manage or reschedule: {{manage_url}}",
    },
    reminder: {
      channel: "both",
      subject: "Reminder — {{service}} with {{business}} is coming up",
      body:
        "Hi {{customer_first_name}}, this is a reminder for your booking with {{business}} ⏰\n\n" +
        "*{{service}}*\n🗓️ {{date_time}}\n\n" +
        "Manage or reschedule: {{manage_url}}",
    },
  };
}

const CHANNELS: MessageChannel[] = ["off", "whatsapp", "email", "both"];

// Sanitize the optional per-locale override map: keep only supported locales,
// only string subject/body, and drop any override that ends up empty. Returns
// undefined when nothing survives so we never persist an empty `i18n` object.
function normalizeI18n(raw: unknown): MessageTemplate["i18n"] {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as Record<string, unknown>;
  const out: Partial<Record<Locale, { subject?: string; body?: string }>> = {};
  for (const locale of SUPPORTED_LOCALES) {
    const entry = source[locale];
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { subject?: unknown; body?: unknown };
    const override: { subject?: string; body?: string } = {};
    // Keep only non-empty string fields — an empty/whitespace override means
    // "fall back to the base text", so we drop it rather than persist "".
    if (typeof e.subject === "string" && e.subject.trim() !== "") override.subject = e.subject;
    if (typeof e.body === "string" && e.body.trim() !== "") override.body = e.body;
    if (override.subject !== undefined || override.body !== undefined) out[locale] = override;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeTemplate(raw: unknown, fallback: MessageTemplate): MessageTemplate {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const t = raw as Partial<MessageTemplate>;
  const tpl: MessageTemplate = {
    channel: CHANNELS.includes(t.channel as MessageChannel) ? (t.channel as MessageChannel) : fallback.channel,
    subject: typeof t.subject === "string" ? t.subject : fallback.subject,
    body: typeof t.body === "string" ? t.body : fallback.body,
  };
  const i18n = normalizeI18n(t.i18n);
  if (i18n) tpl.i18n = i18n;
  return tpl;
}

// Fill in any missing template so downstream code can trust the shape.
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

// Resolve the subject/body for a given locale: a present per-locale override
// wins field-by-field over the top-level (English/fallback) text. Mirrors what
// the edge function does server-side; the UI may use it for preview.
export function localizedTemplate(tpl: MessageTemplate, locale: Locale): { subject: string; body: string } {
  const override = tpl.i18n?.[locale];
  return {
    subject: typeof override?.subject === "string" ? override.subject : tpl.subject,
    body: typeof override?.body === "string" ? override.body : tpl.body,
  };
}

// Substitute {{variables}}. Known keys are replaced (missing → empty string);
// unknown placeholders are left untouched so typos are visible to the owner.
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in vars ? vars[key] ?? "" : match
  );
}

// Human-readable errors for a template (empty ⇒ valid). Used before persisting.
export function validateMessageTemplate(t: MessageTemplate, label: string): string[] {
  const errors: string[] = [];
  if (!CHANNELS.includes(t.channel)) errors.push(`${label}: invalid channel.`);
  if (t.channel === "off") return errors; // disabled — body/subject don't matter
  if (!t.body.trim()) errors.push(`${label}: message body can't be empty.`);
  if ((t.channel === "email" || t.channel === "both") && !t.subject.trim())
    errors.push(`${label}: email subject can't be empty.`);
  return errors;
}
