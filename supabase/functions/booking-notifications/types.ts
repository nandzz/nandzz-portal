// Local types for the booking-notifications edge function (Deno). These mirror
// the Node-side shapes in `src/lib/types.ts` and `src/lib/i18n/translations.ts`
// but are self-contained: edge functions can't import the server-only Next code.

export const SUPPORTED_LOCALES = ["en", "pt", "fr", "es", "ja", "de", "it"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

// Coerce any raw value to a supported locale; unknown/blank → "en".
export function resolveLocale(raw: unknown): Locale {
  if (typeof raw === "string") {
    const code = raw.trim().toLowerCase().split(/[-_]/)[0];
    if ((SUPPORTED_LOCALES as readonly string[]).includes(code)) return code as Locale;
  }
  return "en";
}

export type MessageChannel = "off" | "whatsapp" | "email" | "both";

// An owner-customizable message template with an optional per-locale override map.
export type MessageTemplate = {
  channel: MessageChannel;
  subject: string; // default (en)
  body: string; // default (en)
  i18n?: Partial<Record<Locale, { subject?: string; body?: string }>>;
};

export type CalendarMessages = {
  confirmation: MessageTemplate;
  cancellation: MessageTemplate;
  reschedule: MessageTemplate; // NEW — customer-facing reschedule notice
  reminder: MessageTemplate; // NEW — customer-facing 24h reminder
};

export type NotifyEvent = "created" | "cancelled" | "rescheduled" | "reminder";
export type NotifyActor = "customer" | "business" | "system";

export type NotifyRequest = {
  booking_id?: string;
  event?: NotifyEvent;
  actor?: NotifyActor;
};

export type BookingServiceSnapshot = {
  service_id?: string;
  name?: string | null;
  duration_min?: number | null;
  staff_name?: string | null;
};

// The fields we read off a widget_bookings row (superset — extra columns ignored).
export type BookingRow = {
  id: string;
  instance_id: string;
  owner_user_id: string;
  service_name: string;
  price_cents: number | null;
  staff_name: string | null;
  // Per-service snapshot — set only for multi-service bookings (null otherwise).
  // staff_name is present on per-service-staff bookings; legacy rows omit it.
  services: BookingServiceSnapshot[] | null;
  starts_at: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  manage_token: string;
  created_by_user_id: string | null;
  locale: string | null;
  status: string;
  created_at: string;
};

// Reminders are meant to nudge a customer ~a day before an appointment they
// booked well in advance. When a booking is made close to its start time the
// confirmation email already IS the reminder, so a follow-up would be redundant
// (and, worse, arrive minutes after the confirmation). This returns true when a
// reminder should be SUPPRESSED: the booking was created less than `leadHours`
// before it starts — which also covers every same-day booking. The cron job
// applies the same rule in SQL; this is the send-layer backstop.
export const REMINDER_LEAD_HOURS = 25;

export function reminderIsRedundant(
  createdAt: string,
  startsAt: string,
  leadHours: number = REMINDER_LEAD_HOURS,
): boolean {
  const created = new Date(createdAt).getTime();
  const starts = new Date(startsAt).getTime();
  if (Number.isNaN(created) || Number.isNaN(starts)) return false;
  return starts - created < leadHours * 3_600_000;
}
