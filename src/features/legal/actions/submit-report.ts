"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { COMPANY } from "../company";
import { contentReportSchema, type ContentReportInput } from "../schemas";

export type SubmitReportResult =
  | { ok: true; id: string }
  | { ok: false; error: "INVALID_INPUT" | "RATE_LIMITED" | "FAILED" };

const MAX_PER_HOUR = 5;

// Same client-IP rule as recordProfileView: Amplify/CloudFront appends the
// real client IP as the LAST X-Forwarded-For entry.
function clientIp(h: Headers): string {
  const parts = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? h.get("x-real-ip") ?? "unknown";
}

// Records a DSA Art. 16 notice. Anyone (signed in or not) may submit; the row
// is written with the service role because content_reports has no client
// access. Rate-limited per daily-rotating IP hash (nothing raw is stored).
export async function submitContentReport(input: ContentReportInput): Promise<SubmitReportResult> {
  const parsed = contentReportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const r = parsed.data;

  const h = await headers();
  const day = new Date().toISOString().split("T")[0];
  const submitterKey = createHash("sha256")
    .update([process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", day, "report", clientIp(h)].join("|"))
    .digest("hex");

  const admin = createAdminClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("content_reports")
    .select("id", { count: "exact", head: true })
    .eq("submitter_key", submitterKey)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_HOUR) return { ok: false, error: "RATE_LIMITED" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await admin
    .from("content_reports")
    .insert({
      url: r.url,
      reason: r.reason,
      details: r.details,
      reporter_name: r.name || null,
      reporter_email: r.email || null,
      reporter_user_id: user?.id ?? null,
      good_faith: r.goodFaith,
      submitter_key: submitterKey,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "FAILED" };

  // Notify the moderation inbox and (Art. 16(4) DSA) confirm receipt to the
  // reporter. sendEmail degrades to a log line until SES is wired in Next.
  await Promise.allSettled([
    sendEmail({
      to: COMPANY.emails.dsa,
      subject: `[Report ${r.reason}] ${r.url}`,
      html: `<p><b>Reason:</b> ${r.reason}</p><p><b>URL:</b> ${escapeHtml(r.url)}</p><p>${escapeHtml(
        r.details
      )}</p><p>Report id: ${data.id}</p>`,
      replyTo: r.email || undefined,
    }),
    r.email
      ? sendEmail({
          to: r.email,
          subject: "We received your report — Nandzz",
          html: `<p>Thank you. We received your report about ${escapeHtml(
            r.url
          )} and will review it without undue delay. Reference: ${data.id}</p>`,
        })
      : Promise.resolve(false),
  ]);

  return { ok: true, id: data.id };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
