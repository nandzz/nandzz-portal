// WhatsApp reminder drain for booking-notifications.
//
// Drains the `booking_whatsapp` pgmq queue (filled by the */5
// `booking-whatsapp-reminders` cron and by the admin test-send RPC). Runs inside
// the existing `mode:"drain"` invocation after the email queue, so the same */1
// heartbeat drives both.
//
// Template: app_settings `booking_whatsapp_template` — global `enabled` switch +
// per-locale Meta-approved Twilio Content template (`content_sid`) whose numbered
// placeholders map to booking variables (`variables: {"1": "customer_first_name"}`).
// Edited in nandzz-admin. Locale falls back to `en`.
//
// Queue messages:
//   { kind: "reminder", booking_id }  — re-checks every gate at send time
//   { kind: "test", log_id }          — admin test send, sample data, ignores `enabled`
//
// Every outcome is written to `whatsapp_messages`. Bookkeeping: success / skip /
// permanent Twilio error (4xx) ⇒ delete; retryable error ⇒ left for the
// visibility timeout, then logged as failed + deleted on its MAX_READS-th read.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { bookingMessageVars, currencySymbol, type BookingMessageContext } from "./messages.ts";
import { bookingServiceLines, type OwnerProfile } from "./render.ts";
import {
  readTwilioConfig,
  sanitizeParam,
  sendWhatsAppTemplate,
  toWhatsAppAddress,
  TwilioSendError,
  type TwilioConfig,
} from "./twilio.ts";
import { resolveLocale, type BookingRow, type Locale } from "./types.ts";

export const WHATSAPP_SETTING_KEY = "booking_whatsapp_template";

const READ_QTY = 50;
const VT = 60;
const MAX_READS = 5;
// Bookings booked closer than this to their start skip the reminder (mirrors SQL).
export const WHATSAPP_REMINDER_LEAD_HOURS = 5;

const LOG = "[booking-notifications:whatsapp]";

export type WhatsAppLocaleTemplate = {
  content_sid: string;
  variables: Record<string, string>; // placeholder number → variable key
  preview?: string;
};

export type WhatsAppTemplates = {
  enabled: boolean;
  reminder: Partial<Record<Locale, WhatsAppLocaleTemplate>>;
};

export async function loadWhatsAppTemplates(admin: SupabaseClient): Promise<WhatsAppTemplates | null> {
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", WHATSAPP_SETTING_KEY)
    .maybeSingle();
  if (error) console.error(`${LOG} template load error:`, error.message);
  const v = (data as { value?: unknown } | null)?.value as Partial<WhatsAppTemplates> | undefined;
  if (!v || typeof v !== "object") return null;
  return {
    enabled: v.enabled === true,
    reminder: (v.reminder && typeof v.reminder === "object" ? v.reminder : {}) as WhatsAppTemplates["reminder"],
  };
}

export function pickWhatsAppTemplate(
  templates: WhatsAppTemplates | null,
  locale: Locale,
): (WhatsAppLocaleTemplate & { locale: Locale }) | null {
  if (!templates) return null;
  for (const loc of [locale, "en" as Locale]) {
    const t = templates.reminder[loc];
    if (t && typeof t.content_sid === "string" && t.content_sid.trim()) {
      return { ...t, content_sid: t.content_sid.trim(), locale: loc };
    }
  }
  return null;
}

// Map the template's numbered placeholders to sanitized values. Unknown variable
// keys resolve to "-" (WhatsApp rejects empty parameters).
export function contentVariables(
  mapping: Record<string, string>,
  vars: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [slot, key] of Object.entries(mapping ?? {})) {
    if (!/^\d+$/.test(slot)) continue;
    out[slot] = sanitizeParam(vars[key] ?? "");
  }
  return out;
}

// The variable map a WhatsApp template can reference. Same keys as the email
// templates (text forms), plus `manage_token` for URL-button suffixes
// (`https://nandzz.com/booking/{{n}}`).
export function whatsAppVars(
  booking: BookingRow,
  owner: OwnerProfile | null,
  config: Record<string, unknown>,
  locale: Locale,
  siteUrl: string,
): Record<string, string> {
  const timezone = typeof config.timezone === "string" && config.timezone ? config.timezone : "UTC";
  const ctx: BookingMessageContext = {
    customerName: booking.customer_name,
    businessName: owner?.display_name || owner?.username || "your provider",
    serviceName: booking.service_name,
    staffName: booking.staff_name ?? null,
    services: bookingServiceLines(booking),
    startsAt: booking.starts_at,
    timezone,
    priceCents: booking.price_cents,
    currencySymbol: currencySymbol(typeof config.currency === "string" ? config.currency : null),
    manageUrl: `${siteUrl}/booking/${booking.manage_token}`,
  };
  const vars = bookingMessageVars(ctx, locale);
  delete vars.multi_service;
  delete vars.single_service;
  return { ...vars, manage_token: booking.manage_token };
}

// Sample values for admin test sends (no real booking involved).
export function sampleWhatsAppVars(siteUrl: string): Record<string, string> {
  return {
    customer_name: "Alex Johnson",
    customer_first_name: "Alex",
    service: "Haircut",
    services: "Haircut (Maria)",
    staff: "Maria",
    date_time: "Today at 3:00 PM",
    business: "Nandzz Test Studio",
    price: "€35",
    manage_url: `${siteUrl}/booking/test`,
    manage_token: "test",
  };
}

// Send-time re-check of the reminder gates (the cron applies them in SQL).
export function reminderSkipReason(
  booking: BookingRow & { whatsapp_opt_in?: boolean | null },
  config: Record<string, unknown>,
  now: Date = new Date(),
): string | null {
  if (booking.status !== "confirmed") return "not_confirmed";
  if (!booking.whatsapp_opt_in) return "no_opt_in";
  if (config.whatsapp_reminder === false) return "business_disabled";
  const starts = new Date(booking.starts_at).getTime();
  const created = new Date(booking.created_at).getTime();
  if (starts <= now.getTime()) return "already_started";
  if (starts - created < WHATSAPP_REMINDER_LEAD_HOURS * 3_600_000) return "booked_too_late";
  return null;
}

type QueueMessage = {
  msg_id: number;
  read_ct: number;
  message: { kind?: unknown; booking_id?: unknown; log_id?: unknown };
};

type Outcome = "delete" | "retry";

type LogFields = {
  status: "sent" | "failed" | "skipped";
  twilio_sid?: string | null;
  error?: string | null;
  content_sid?: string | null;
  locale?: string | null;
};

async function updateLog(admin: SupabaseClient, id: string, fields: LogFields) {
  const { error } = await admin
    .from("whatsapp_messages")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error(`${LOG} log update failed:`, error.message);
}

async function insertLog(
  admin: SupabaseClient,
  row: { booking_id: string; to_phone: string } & LogFields,
) {
  const { error } = await admin.from("whatsapp_messages").insert({ kind: "reminder", ...row });
  if (error) console.error(`${LOG} log insert failed:`, error.message);
}

// Attempt one send; translate the result into a queue outcome + log fields.
async function trySend(
  twilio: TwilioConfig | null,
  to: string | null,
  tpl: (WhatsAppLocaleTemplate & { locale: Locale }) | null,
  vars: Record<string, string>,
  readCt: number,
): Promise<{ outcome: Outcome; log: LogFields | null }> {
  if (!twilio) return { outcome: "delete", log: { status: "skipped", error: "twilio_not_configured" } };
  if (!to) return { outcome: "delete", log: { status: "skipped", error: "invalid_phone" } };
  if (!tpl) return { outcome: "delete", log: { status: "skipped", error: "no_template_for_locale" } };
  const meta = { content_sid: tpl.content_sid, locale: tpl.locale };
  try {
    const sid = await sendWhatsAppTemplate(twilio, {
      to,
      contentSid: tpl.content_sid,
      variables: contentVariables(tpl.variables, vars),
    });
    return { outcome: "delete", log: { status: "sent", twilio_sid: sid, ...meta } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const permanent = err instanceof TwilioSendError && err.permanent;
    console.error(`${LOG} send failed (${permanent ? "permanent" : "retryable"}):`, msg);
    if (permanent || readCt >= MAX_READS) {
      return { outcome: "delete", log: { status: "failed", error: msg, ...meta } };
    }
    return { outcome: "retry", log: null }; // reappears after VT; logged on final attempt
  }
}

export type WhatsAppDrainResult = { drained: number; sent: number; failed: number; skipped: number };

export async function runWhatsAppDrain(
  admin: SupabaseClient,
  siteUrl: string,
  deadline: number,
): Promise<WhatsAppDrainResult> {
  const result: WhatsAppDrainResult = { drained: 0, sent: 0, failed: 0, skipped: 0 };
  const templates = await loadWhatsAppTemplates(admin);
  const twilio = readTwilioConfig();

  while (Date.now() < deadline) {
    const { data, error } = await admin.rpc("whatsapp_queue_read", { p_qty: READ_QTY, p_vt: VT });
    if (error) {
      console.error(`${LOG} whatsapp_queue_read failed:`, error.message);
      break;
    }
    const messages = (data ?? []) as QueueMessage[];
    if (messages.length === 0) break;
    result.drained += messages.length;

    // Batch-load the bookings + their instances for the reminder messages.
    const bookingIds = [
      ...new Set(
        messages
          .map((m) => m.message?.booking_id)
          .filter((id): id is string => typeof id === "string" && !!id),
      ),
    ];
    const bookings = new Map<string, BookingRow & { whatsapp_opt_in?: boolean }>();
    const instances = new Map<string, { config: Record<string, unknown>; owner: OwnerProfile | null }>();
    if (bookingIds.length) {
      const { data: rows, error: bErr } = await admin.from("widget_bookings").select("*").in("id", bookingIds);
      if (bErr) console.error(`${LOG} booking load error:`, bErr.message);
      for (const b of (rows ?? []) as BookingRow[]) bookings.set(b.id, b);
      const instanceIds = [...new Set([...bookings.values()].map((b) => b.instance_id))];
      if (instanceIds.length) {
        const { data: insts, error: iErr } = await admin
          .from("widget_instances")
          .select("id, config, owner:profiles(display_name, username, locale)")
          .in("id", instanceIds);
        if (iErr) console.error(`${LOG} instance load error:`, iErr.message);
        for (const i of (insts ?? []) as Array<{ id: string; config: unknown; owner: unknown }>) {
          instances.set(i.id, {
            config: (i.config ?? {}) as Record<string, unknown>,
            owner: (i.owner ?? null) as OwnerProfile | null,
          });
        }
      }
    }

    // Test-send log rows (phone + locale live on the log row).
    const logIds = messages
      .map((m) => m.message?.log_id)
      .filter((id): id is string => typeof id === "string" && !!id);
    const testRows = new Map<string, { to_phone: string; locale: string | null }>();
    if (logIds.length) {
      const { data: rows } = await admin.from("whatsapp_messages").select("id, to_phone, locale").in("id", logIds);
      for (const r of (rows ?? []) as Array<{ id: string; to_phone: string; locale: string | null }>) {
        testRows.set(r.id, r);
      }
    }

    const deleteIds: number[] = [];

    for (const m of messages) {
      const kind = m.message?.kind;
      let outcome: Outcome = "delete";

      if (kind === "test" && typeof m.message.log_id === "string") {
        const row = testRows.get(m.message.log_id);
        if (row) {
          const locale = resolveLocale(row.locale);
          const sent = await trySend(
            twilio,
            toWhatsAppAddress(row.to_phone),
            pickWhatsAppTemplate(templates, locale),
            sampleWhatsAppVars(siteUrl),
            m.read_ct,
          );
          outcome = sent.outcome;
          if (sent.log) await updateLog(admin, m.message.log_id, sent.log);
          tally(result, sent.log);
        }
      } else if (kind === "reminder" && typeof m.message.booking_id === "string") {
        const booking = bookings.get(m.message.booking_id);
        const inst = booking ? instances.get(booking.instance_id) : undefined;
        if (!booking) {
          result.skipped++;
        } else if (!templates?.enabled) {
          result.skipped++; // switched off after enqueue
        } else {
          const skip = reminderSkipReason(booking, inst?.config ?? {});
          if (skip) {
            result.skipped++;
          } else {
            const locale = resolveLocale(booking.locale);
            const sent = await trySend(
              twilio,
              toWhatsAppAddress(booking.customer_phone),
              pickWhatsAppTemplate(templates, locale),
              whatsAppVars(booking, inst?.owner ?? null, inst?.config ?? {}, locale, siteUrl),
              m.read_ct,
            );
            outcome = sent.outcome;
            if (sent.log) {
              await insertLog(admin, {
                booking_id: booking.id,
                to_phone: booking.customer_phone ?? "",
                ...sent.log,
              });
            }
            tally(result, sent.log);
          }
        }
      } else {
        result.skipped++; // malformed message
      }

      if (outcome === "delete") deleteIds.push(m.msg_id);
    }

    if (deleteIds.length) {
      const { error: e } = await admin.rpc("whatsapp_queue_delete", { p_msg_ids: deleteIds });
      if (e) console.error(`${LOG} whatsapp_queue_delete failed:`, e.message);
    }
    // Anything not deleted is a retry waiting for its VT — stop this run.
    if (deleteIds.length < messages.length) break;
  }

  return result;
}

function tally(result: WhatsAppDrainResult, log: LogFields | null) {
  if (!log) return;
  if (log.status === "sent") result.sent++;
  else if (log.status === "failed") result.failed++;
  else result.skipped++;
}
