// Shared email-job building + rendering for the booking-notifications function.
//
// Extracted from index.ts so BOTH the single-`booking_id` path and the batched
// `drain` path build recipients and render templates through the SAME logic.
// "Given a loaded booking + instance owner/config + resolved business
// email + templates, decide recipients (event × actor matrix) and build the list
// of emails to send." Pure: no DB, no SES, no env reads beyond the caller-supplied
// siteUrl. The auth-fallback lookup for a missing owner email stays in the caller
// (it needs the admin client); `businessEmail` is passed in already resolved.

import {
  bookingMessageVars,
  currencySymbol,
  renderTemplate,
  type BookingMessageContext,
  type BookingServiceLine,
} from "./messages.ts";
import { escapeHtml } from "./emails.ts";
import { pickTemplate, type EmailContent, type EmailTemplates } from "./config.ts";
import {
  resolveLocale,
  type BookingRow,
  type Locale,
  type NotifyActor,
  type NotifyEvent,
} from "./types.ts";

// Per-profile brand-colour defaults (match the portal brand editor).
const DEFAULT_BRAND = { primary: "#7c3aed", accent: "#f59e0b", background: "#ffffff" };

// The owner profile shape joined off widget_instances (superset — extra ignored).
export type OwnerProfile = {
  display_name?: string | null;
  username?: string | null;
  email?: string | null;
  locale?: string | null;
  logo_url?: string | null;
  avatar_url?: string | null;
  brand_colors?: Record<string, string> | null;
};

// One email we intend to send.
export type EmailJob = {
  id: string; // e.g. "customer:confirmation" — reported in `sent`
  to: string;
  subject: string;
  html: string;
};

// Which template kind backs each event's CUSTOMER email.
const CUSTOMER_KIND: Record<NotifyEvent, string> = {
  created: "confirmation",
  cancelled: "cancellation",
  rescheduled: "reschedule",
  reminder: "reminder",
};

// ── Rendering ─────────────────────────────────────────────────────────────────

// Validate a hex colour; fall back to the given default.
function hexOr(v: unknown, fallback: string): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v.trim()) ? v.trim() : fallback;
}

function resolveBrandColors(raw: Record<string, string> | null | undefined) {
  return {
    primary: hexOr(raw?.primary, DEFAULT_BRAND.primary),
    accent: hexOr(raw?.accent, DEFAULT_BRAND.accent),
    background: hexOr(raw?.background, DEFAULT_BRAND.background),
  };
}

// The {{business_avatar}} value: the business image, or a lettered circle in the
// brand colour when there's no image. This is the one bit of dynamic HTML the
// function still produces (per-business, not a layout choice).
function businessAvatarHtml(imageUrl: string, businessName: string, accent: string): string {
  if (imageUrl) {
    return `<img src="${escapeHtml(imageUrl)}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border-radius:24px;object-fit:cover;border:1px solid #e5e7eb" />`;
  }
  const initial = escapeHtml((businessName.trim()[0] || "N").toUpperCase());
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td align="center" valign="middle" style="width:48px;height:48px;background:${accent};border-radius:24px;color:#ffffff;font:600 20px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">${initial}</td></tr></table>`;
}

// The booked services as email-safe table rows (dropped into the template's
// details table via {{services}}): each service name, with its staff member as a
// muted line underneath when one is assigned. Handles 1..n services, each with a
// different (or no) staff member.
const ROW_FONT = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
export function servicesHtml(services: BookingServiceLine[]): string {
  return services
    .map((s, i) => {
      const top = i === 0 ? 0 : 8;
      const name = `<tr><td style="padding:${top}px 0 2px;font:600 15px/1.45 ${ROW_FONT};color:#111827">${escapeHtml(s.name)}</td></tr>`;
      const staff = s.staffName
        ? `<tr><td style="padding:0 0 2px;font:400 13px/1.45 ${ROW_FONT};color:#6b7280">${escapeHtml(s.staffName)}</td></tr>`
        : "";
      return name + staff;
    })
    .join("");
}

// The booking's services in order, each with its staff. Multi-service bookings
// carry a `services` snapshot (per-service staff on segmented bookings; legacy
// rows share the parent's single staff). Single-service bookings have no
// snapshot, so the parent row is the one line.
export function bookingServiceLines(booking: BookingRow): BookingServiceLine[] {
  const fallbackStaff = booking.staff_name ?? null;
  const snap = Array.isArray(booking.services) ? booking.services : [];
  const lines = snap
    .filter((s) => s && typeof s.name === "string" && s.name.trim() !== "")
    .map((s) => ({ name: s.name as string, staffName: s.staff_name || fallbackStaff }));
  return lines.length > 0 ? lines : [{ name: booking.service_name, staffName: fallbackStaff }];
}

// Bare emergency HTML used only if the DB template row is missing.
function fallbackHtml(htmlVars: Record<string, string>): EmailContent {
  return {
    subject: "Booking update",
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111;font-size:15px;line-height:1.6"><p><strong>${htmlVars.service}</strong></p><p>${htmlVars.date_time}</p><p><a href="${htmlVars.manage_url}">Manage booking</a></p></div>`,
  };
}

// Pick the DB template for audience/kind/locale and inject the variables. Subject
// uses raw values; HTML uses HTML-escaped text values (plus the raw brand colours
// and {{business_avatar}} markup).
function renderEmail(
  templates: EmailTemplates | null,
  audience: "customer" | "business",
  kind: string,
  locale: Locale,
  ctx: BookingMessageContext,
  brand: { primary: string; accent: string; background: string },
  businessImageUrl: string,
): { subject: string; html: string } {
  const base = bookingMessageVars(ctx, locale); // raw strings

  const textVars: Record<string, string> = {
    ...base,
    brand_primary: brand.primary,
    brand_accent: brand.accent,
    brand_background: brand.background,
    business_image_url: businessImageUrl,
  };

  const htmlVars: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) htmlVars[k] = escapeHtml(v);
  htmlVars.brand_primary = brand.primary;
  htmlVars.brand_accent = brand.accent;
  htmlVars.brand_background = brand.background;
  htmlVars.business_image_url = escapeHtml(businessImageUrl);
  htmlVars.business_avatar = businessAvatarHtml(businessImageUrl, ctx.businessName, brand.primary);
  htmlVars.services = servicesHtml(ctx.services);

  const tpl: EmailContent =
    (templates && pickTemplate(templates, audience, kind, locale)) || fallbackHtml(htmlVars);

  return {
    subject: renderTemplate(tpl.subject, textVars),
    html: renderTemplate(tpl.html, htmlVars),
  };
}

// ── Recipient matrix helpers ─────────────────────────────────────────────────

// True when the CUSTOMER should get an email for this event/actor.
export function customerEmailWanted(event: NotifyEvent, actor: NotifyActor): boolean {
  switch (event) {
    case "created":
      return true; // both actors → confirmation to customer
    case "cancelled":
      return actor === "business"; // owner cancelled → tell the customer
    case "rescheduled":
      return actor === "business"; // owner rescheduled → tell the customer
    case "reminder":
      return true; // system → customer reminder
    default:
      return false;
  }
}

// Which business notice (if any) to send for this event/actor.
export function businessEmailKind(event: NotifyEvent, actor: NotifyActor): string | null {
  switch (event) {
    case "created":
      return actor === "business" ? null : "new_booking"; // owner-made ⇒ they know
    case "cancelled":
      return actor === "customer" ? "customer_cancelled" : null;
    case "rescheduled":
      return actor === "customer" ? "customer_rescheduled" : null;
    case "reminder":
      return null;
    default:
      return null;
  }
}

// ── Job building (shared by the single + drain paths) ─────────────────────────

export type BuildEmailJobsInput = {
  booking: BookingRow;
  owner: OwnerProfile | null;
  config: Record<string, unknown>;
  businessEmail: string; // already resolved (profile email or auth fallback) by the caller
  templates: EmailTemplates | null;
  event: NotifyEvent;
  actor: NotifyActor;
  siteUrl: string;
};

// Decide recipients from the event × actor matrix and render the emails to send.
// Returns the jobs plus the same `skipped` reason strings the single path emits
// for no-email recipients. Identical behaviour to the pre-refactor inline block.
export function buildEmailJobs(
  input: BuildEmailJobsInput,
): { jobs: EmailJob[]; skipped: string[] } {
  const { booking, owner, config, businessEmail, templates, event, actor, siteUrl } = input;

  // Currency lives on the calendar config (owner-selected per widget), not the
  // catalog. Falls back to the helper's default when a legacy config has none.
  const configCurrency = typeof config.currency === "string" ? config.currency : null;

  const timezone =
    typeof config.timezone === "string" && config.timezone ? config.timezone : "UTC";
  const businessName = owner?.display_name || owner?.username || "your provider";
  const businessImageUrl = owner?.logo_url?.trim() || owner?.avatar_url?.trim() || "";
  const brand = resolveBrandColors(owner?.brand_colors);

  const customerLocale: Locale = resolveLocale(booking.locale);
  const businessLocale: Locale = resolveLocale(owner?.locale);

  const ctx: BookingMessageContext = {
    customerName: booking.customer_name,
    businessName,
    serviceName: booking.service_name,
    staffName: booking.staff_name ?? null,
    services: bookingServiceLines(booking),
    startsAt: booking.starts_at,
    timezone,
    priceCents: booking.price_cents,
    currencySymbol: currencySymbol(configCurrency),
    manageUrl: `${siteUrl}/booking/${booking.manage_token}`,
  };

  const wantCustomer = customerEmailWanted(event, actor);
  const businessKind = businessEmailKind(event, actor);

  const jobs: EmailJob[] = [];
  const skipped: string[] = [];

  if (wantCustomer) {
    const kind = CUSTOMER_KIND[event];
    const to = booking.customer_email?.trim() || "";
    if (!to) {
      skipped.push(`customer:${kind}:no_email`);
    } else {
      const rendered = renderEmail(
        templates,
        "customer",
        kind,
        customerLocale,
        ctx,
        brand,
        businessImageUrl,
      );
      jobs.push({ id: `customer:${kind}`, to, subject: rendered.subject, html: rendered.html });
    }
  }

  if (businessKind) {
    if (!businessEmail) {
      skipped.push(`business:${businessKind}:no_email`);
    } else {
      const rendered = renderEmail(
        templates,
        "business",
        businessKind,
        businessLocale,
        ctx,
        brand,
        businessImageUrl,
      );
      jobs.push({
        id: `business:${businessKind}`,
        to: businessEmail,
        subject: rendered.subject,
        html: rendered.html,
      });
    }
  }

  return { jobs, skipped };
}
