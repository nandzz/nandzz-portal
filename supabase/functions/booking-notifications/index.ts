// booking-notifications — unified, localized booking email sender (Deno + SES).
//
// Called by the DB insert trigger (create), Next.js server routes (owner/customer
// cancel + reschedule), and — in `mode: "drain"` — a `*/1` cron heartbeat that
// drains a pgmq queue of reminder jobs (see drain.ts), then the WhatsApp
// reminder queue (see whatsapp.ts — ~4h reminders + admin test sends via Twilio).
// The single path loads everything it needs from `booking_id`
// with the service-role key, decides recipients from the event × actor matrix,
// then sends localized email(s) via Amazon SES. The recipient/render logic is
// shared with the drain path via render.ts (`buildEmailJobs`).
//
// The email LAYOUT lives entirely in the DB (app_settings `booking_email_template`,
// edited in the nandzz-admin app). This function just fetches the matching HTML
// template, injects the booking + brand variables, and sends. It carries no email
// design of its own beyond a bare emergency fallback used only if the row is gone.
//
// Injected variables: {{business}}, {{business_avatar}} (business logo/avatar img,
// or a lettered circle when none), {{business_image_url}}, {{brand_primary}},
// {{brand_accent}}, {{brand_background}} (the business's own brand colours),
// {{customer_name}}, {{customer_first_name}}, {{service}}, {{staff}}, {{date_time}},
// {{price}}, {{manage_url}}, {{services}} (HTML rows: each booked service + its
// staff member), {{multi_service}}/{{single_service}} (section flags for a
// singular/plural label). {{staff}} is the distinct staff names, comma-joined.
//
// Auth: shared-secret header `x-booking-notify-secret` vs env BOOKING_NOTIFY_SECRET
// (401 on mismatch) — enforced for ALL modes. Runs with verify_jwt = false.
//
// Secrets: BOOKING_NOTIFY_SECRET, SES_REGION, SES_ACCESS_KEY_ID,
//   SES_SECRET_ACCESS_KEY, SES_EMAIL_FROM, (optional) PUBLIC_SITE_URL,
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (WhatsApp drain).
// Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Contract: never throw to the caller. 401 (bad secret), 400 (missing
// booking_id, single path), else 200. Single: { ok, sent: [...], skipped: [...] }.
// Drain: { ok, drained, sent, skipped, archived, whatsapp: { drained, sent, failed, skipped } }.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { loadTemplates } from "./config.ts";
import { readSesConfig, sendSesEmail } from "./ses.ts";
import { buildEmailJobs, type OwnerProfile } from "./render.ts";
import { BUDGET_MS, INSTANCE_SELECT, runDrain } from "./drain.ts";
import { runWhatsAppDrain } from "./whatsapp.ts";
import {
  reminderIsRedundant,
  type BookingRow,
  type NotifyActor,
  type NotifyEvent,
} from "./types.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-booking-notify-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const LOG = "[booking-notifications]";

function siteUrl(): string {
  return (Deno.env.get("PUBLIC_SITE_URL") ?? "https://nandzz.com").replace(/\/$/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  // ── Auth: shared-secret header (ALL modes) ─────────────────────────────────
  const expected = Deno.env.get("BOOKING_NOTIFY_SECRET");
  const provided = req.headers.get("x-booking-notify-secret");
  if (!expected || !provided || provided !== expected) {
    console.warn(`${LOG} unauthorized (bad or missing secret)`);
    return json({ error: "unauthorized" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ── Drain mode: batched pgmq queue drain (see drain.ts) ─────────────────────
  if (payload.mode === "drain") {
    const started = Date.now();
    let email: Awaited<ReturnType<typeof runDrain>> = { ok: true, drained: 0, sent: 0, skipped: 0, archived: 0 };
    try {
      email = await runDrain(admin, siteUrl());
    } catch (err) {
      // Never throw to the cron — log and 200 so the heartbeat doesn't retry-storm.
      console.error(`${LOG} drain unhandled error:`, err instanceof Error ? err.stack ?? err.message : err);
    }
    // WhatsApp queue gets whatever is left of the shared budget (min 5s so a
    // long email drain can't starve it entirely; both queues are small).
    let whatsapp = { drained: 0, sent: 0, failed: 0, skipped: 0 };
    try {
      const deadline = Math.max(started + BUDGET_MS, Date.now() + 5_000);
      whatsapp = await runWhatsAppDrain(admin, siteUrl(), deadline);
    } catch (err) {
      console.error(`${LOG} whatsapp drain unhandled error:`, err instanceof Error ? err.stack ?? err.message : err);
    }
    return json({ ...email, whatsapp });
  }

  // ── Single path (unchanged behaviour) ───────────────────────────────────────
  const bookingId = typeof payload.booking_id === "string" ? payload.booking_id : "";
  if (!bookingId) return json({ error: "booking_id is required" }, 400);

  const event = (typeof payload.event === "string" ? payload.event : "created") as NotifyEvent;
  const actor = (typeof payload.actor === "string" ? payload.actor : "customer") as NotifyActor;

  const sent: string[] = [];
  const skipped: string[] = [];

  try {
    // ── Load the booking ─────────────────────────────────────────────────────
    const { data: bookingData, error: bookingErr } = await admin
      .from("widget_bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingErr) console.error(`${LOG} booking load error:`, bookingErr.message);
    const booking = bookingData as BookingRow | null;
    if (!booking) {
      console.warn(`${LOG} booking ${bookingId} not found — no-op`);
      return json({ ok: true, sent, skipped: ["booking_not_found"] });
    }

    // ── Reminder backstop ─────────────────────────────────────────────────────
    // The cron already filters these out in SQL, but re-check at the send layer
    // so a reminder is never emitted for a cancelled booking, nor for one booked
    // too close to its start (the confirmation already covered it — see
    // reminderIsRedundant). Idempotent + defensive against a stale/duplicate fire.
    if (event === "reminder") {
      if (booking.status !== "confirmed") {
        return json({ ok: true, sent, skipped: ["reminder:not_confirmed"] });
      }
      if (reminderIsRedundant(booking.created_at, booking.starts_at)) {
        return json({ ok: true, sent, skipped: ["reminder:redundant_same_day"] });
      }
    }

    // ── Load instance config + owner profile ─────────────────────────────────
    const { data: instance } = await admin
      .from("widget_instances")
      .select(INSTANCE_SELECT)
      .eq("id", booking.instance_id)
      .maybeSingle();

    const owner = (instance?.owner ?? null) as OwnerProfile | null;
    const config = (instance?.config ?? {}) as Record<string, unknown>;

    // Business email address: profiles.email, else auth.users.email (service role).
    let businessEmail = owner?.email?.trim() || "";
    if (!businessEmail && booking.owner_user_id) {
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(booking.owner_user_id);
        businessEmail = authUser?.user?.email?.trim() || "";
      } catch (err) {
        console.error(`${LOG} auth.users email lookup failed:`, err instanceof Error ? err.message : err);
      }
    }

    // ── Templates (authoritative, from the DB) ───────────────────────────────
    const templates = await loadTemplates(admin);
    if (!templates) {
      console.error(`${LOG} app_settings 'booking_email_template' missing/invalid — using bare fallback`);
    }

    // ── Decide recipients + render (shared with the drain path) ──────────────
    const { jobs, skipped: jobSkips } = buildEmailJobs({
      booking,
      owner,
      config,
      businessEmail,
      templates,
      event,
      actor,
      siteUrl: siteUrl(),
    });
    for (const s of jobSkips) skipped.push(s);

    if (jobs.length === 0) {
      return json({ ok: true, sent, skipped });
    }

    // ── Send via SES (graceful no-op when unconfigured) ──────────────────────
    const ses = readSesConfig();
    if (!ses) {
      console.info(`${LOG} SES not configured`);
      for (const job of jobs) skipped.push(`${job.id}:ses_not_configured`);
      return json({ ok: true, sent, skipped });
    }

    for (const job of jobs) {
      try {
        const messageId = await sendSesEmail(ses, { to: job.to, subject: job.subject, html: job.html });
        sent.push(job.id);
        console.info(`${LOG} sent ${job.id} → ${job.to} (SES MessageId: ${messageId})`);
      } catch (err) {
        skipped.push(`${job.id}:send_failed`);
        console.error(`${LOG} send failed for ${job.id}:`, err instanceof Error ? err.message : err);
      }
    }

    return json({ ok: true, sent, skipped });
  } catch (err) {
    // Never throw to the caller — log and 200 so triggers/cron don't retry-storm.
    console.error(`${LOG} unhandled error:`, err instanceof Error ? err.stack ?? err.message : err);
    return json({ ok: true, sent, skipped: [...skipped, "unhandled_error"] });
  }
});
