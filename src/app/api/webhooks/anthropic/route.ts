import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";

// Registered in Anthropic Console → Webhooks.
// The signing secret starts with whsec_ — store only the raw value in ANTHROPIC_WEBHOOK_SECRET.
const WEBHOOK_SECRET = process.env.ANTHROPIC_WEBHOOK_SECRET ?? "";
const AGENT_BETA = "managed-agents-2026-04-01";
const READ_TIMEOUT_MS = 30_000; // session is already done; stream replays quickly

async function verifySignature(rawBody: string, header: string | null): Promise<boolean> {
  if (!WEBHOOK_SECRET || !header) return false;
  // Anthropic uses HMAC-SHA256; signature header format is "v1=<hex>"
  const sigHex = header.startsWith("v1=") ? header.slice(3) : header;
  const secret = WEBHOOK_SECRET.startsWith("whsec_")
    ? WEBHOOK_SECRET.slice(6)
    : WEBHOOK_SECRET;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const sigBytes = Uint8Array.from(sigHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  return crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(rawBody));
}

function isLikelyValidHtml(html: string): boolean {
  const s = html.trim();
  return s.length > 50 && s.includes("<html") && s.includes("</html>") && s.includes("<body");
}

function stripBase64Assets(html: string): { stripped: string; manifest: Record<string, string> } {
  const manifest: Record<string, string> = {};
  let idx = 0;
  const stripped = html.replace(/(src|href)="(data:[^;]+;base64,[^"]+)"/gi, (_m, attr, uri) => {
    const key = `ASSET_PLACEHOLDER_${idx++}`;
    manifest[key] = uri;
    return `${attr}="data:${key}"`;
  });
  return { stripped, manifest };
}

function restoreBase64Assets(html: string, manifest: Record<string, string>): string {
  return html.replace(/data:(ASSET_PLACEHOLDER_\d+)/g, (_m, key) => manifest[key] ?? `data:${key}`);
}

async function extractHtmlFromSession(sessionId: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), READ_TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://api.anthropic.com/v1/sessions/${sessionId}/events/stream`,
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": AGENT_BETA,
          "accept": "text/event-stream",
        },
        signal: abort.signal,
      }
    );

    if (!res.ok || !res.body) {
      throw new Error(`Session stream failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let finalHtml = "";

    outer: while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data) continue;
        try {
          const event = JSON.parse(data);
          if (event.type === "agent.message") {
            finalHtml = "";
            for (const block of (event.content ?? [])) {
              if (block.type === "text") finalHtml += block.text;
            }
          }
          if (event.type === "session.status_idle") break outer;
        } catch { /* skip malformed lines */ }
      }
    }

    reader.cancel().catch(() => {});
    return finalHtml;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-webhook-signature");

  // Verify signature — log if invalid but continue in dev for easier debugging
  const valid = await verifySignature(rawBody, signature).catch(() => false);
  if (!valid) {
    console.warn("[anthropic-webhook] signature verification failed", { signature: signature?.slice(0, 20) });
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ACK all events quickly; only act on session completion
  if (event.type !== "session.status_idled") {
    return NextResponse.json({ ok: true });
  }

  const sessionId =
    (event.session as Record<string, string> | undefined)?.id ??
    (event.session_id as string | undefined);

  if (!sessionId) {
    console.error("[anthropic-webhook] no session_id in payload", event);
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();

  // Find the job
  const { data: job } = await admin
    .from("ai_edit_jobs")
    .select("id, user_id, space_id, instruction, html_url, status")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!job || job.status === "done" || job.status === "error") {
    return NextResponse.json({ ok: true }); // already handled or unknown session
  }

  console.log("[anthropic-webhook] processing job", job.id, "for space", job.space_id);

  try {
    // Extract the agent's HTML output from the session event stream
    let html = await extractHtmlFromSession(sessionId);
    html = html.replace(/^```html?\s*/i, "").replace(/\s*```$/, "").trim();

    if (!isLikelyValidHtml(html)) {
      console.error("[anthropic-webhook] invalid HTML from session", sessionId, "length:", html.length);
      await admin.from("ai_edit_jobs").update({ status: "error", error_code: "ai_invalid_output" }).eq("id", job.id);
      return NextResponse.json({ ok: true });
    }

    // Restore base64 assets by re-fetching the original HTML to rebuild the manifest
    const marker = "/space-html/";
    const cleanUrl = (job.html_url as string).split("?")[0];
    const markerIdx = cleanUrl.indexOf(marker);
    if (markerIdx !== -1) {
      const storagePath = cleanUrl.slice(markerIdx + marker.length);
      const { data: blob } = await admin.storage.from("space-html").download(storagePath);
      if (blob) {
        const rawHtml = await blob.text();
        const { manifest } = stripBase64Assets(rawHtml);
        html = restoreBase64Assets(html, manifest);
      }
    }

    await admin
      .from("ai_edit_jobs")
      .update({ status: "done", result_html: html })
      .eq("id", job.id);

    // Look up space title + owner username for the notification
    const { data: space } = await admin
      .from("spaces")
      .select("title, profiles!inner(username)")
      .eq("id", job.space_id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ownerUsername = (space as any)?.profiles?.username ?? "";

    await createNotification(admin, job.user_id, "ai_edit_ready", {
      space_id: job.space_id,
      space_title: space?.title ?? "your space",
      space_owner_username: ownerUsername,
      job_id: job.id,
      instruction: (job.instruction as string).slice(0, 100),
    });

    console.log("[anthropic-webhook] job done, notification sent", job.id);
  } catch (err) {
    console.error("[anthropic-webhook] processing error", err);
    await admin.from("ai_edit_jobs").update({ status: "error", error_code: "ai_unavailable" }).eq("id", job.id);
  }

  return NextResponse.json({ ok: true });
}
