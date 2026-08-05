// Owner-customizable message templates for the calendar widget: the variable
// catalog, defaults, normalization, and rendering. Pure — safe on client and
// server. Server-side dispatch (actually sending) lives in `notify.ts`.

import type { CalendarMessages, MessageChannel, MessageTemplate } from "@/lib/types";

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

const CURRENCY_SYMBOLS: Record<string, string> = { usd: "$", eur: "€", gbp: "£" };

export function currencySymbol(code: string | null | undefined): string {
  if (!code) return "$";
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
  };
}

const CHANNELS: MessageChannel[] = ["off", "whatsapp", "email", "both"];

function normalizeTemplate(raw: unknown, fallback: MessageTemplate): MessageTemplate {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const t = raw as Partial<MessageTemplate>;
  return {
    channel: CHANNELS.includes(t.channel as MessageChannel) ? (t.channel as MessageChannel) : fallback.channel,
    subject: typeof t.subject === "string" ? t.subject : fallback.subject,
    body: typeof t.body === "string" ? t.body : fallback.body,
  };
}

// Fill in any missing template so downstream code can trust the shape.
export function normalizeCalendarMessages(raw: unknown): CalendarMessages {
  const base = defaultCalendarMessages();
  if (!raw || typeof raw !== "object") return base;
  const m = raw as Partial<CalendarMessages>;
  return {
    confirmation: normalizeTemplate(m.confirmation, base.confirmation),
    cancellation: normalizeTemplate(m.cancellation, base.cancellation),
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
