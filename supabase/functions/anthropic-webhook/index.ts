import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AGENT_BETA = "managed-agents-2026-04-01";

async function verifySignature(
  rawBody: string,
  sigHeader: string | null,
  webhookId: string | null,
  webhookTs: string | null,
  secret: string,
): Promise<boolean> {
  console.error("[sig] sigHeader:", sigHeader, "webhookId:", webhookId, "webhookTs:", webhookTs, "secretLen:", secret.length);
  if (!secret || !sigHeader || !webhookId || !webhookTs) {
    console.error("[sig] early exit — missing required value");
    return false;
  }

  const message = `${webhookId}.${webhookTs}.${rawBody}`;
  console.error("[sig] message to sign (first 100):", message.slice(0, 100));

  const sigB64 = sigHeader.startsWith("v1,") ? sigHeader.slice(3) : sigHeader;
  const rawSecretStr = secret.startsWith("whsec_") ? secret.slice(6) : secret;

  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(rawSecretStr), (c) => c.charCodeAt(0));
    console.error("[sig] secret decoded as base64, keyBytes length:", keyBytes.length);
  } catch {
    keyBytes = new TextEncoder().encode(rawSecretStr);
    console.error("[sig] secret used as UTF-8, keyBytes length:", keyBytes.length);
  }

  const key = await crypto.subtle.importKey(
    "raw", keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false, ["verify"]
  );
  const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
  console.error("[sig] sigBytes length:", sigBytes.length);

  const result = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(message));
  console.error("[sig] verify result:", result);
  return result;
}

function isLikelyValidHtml(html: string): boolean {
  const s = html.trim();
  return s.length > 50 && s.includes("<html") && s.includes("</html>") && s.includes("<body");
}

function stripBase64Assets(html: string): { stripped: string; manifest: Record<string, string> } {
  const manifest: Record<string, string> = {};
  let idx = 0;
  const stripped = html.replace(/(src|href)="(data:[^;]+;base64,[^"]+)"/gi, (_m: string, attr: string, uri: string) => {
    const key = `ASSET_PLACEHOLDER_${idx++}`;
    manifest[key] = uri;
    return `${attr}="data:${key}"`;
  });
  return { stripped, manifest };
}

function restoreBase64Assets(html: string, manifest: Record<string, string>): string {
  return html.replace(/data:(ASSET_PLACEHOLDER_\d+)/g, (_m: string, key: string) => manifest[key] ?? `data:${key}`);
}

type Usage = { input: number; output: number };

// Anthropic Managed Agents can surface usage in a few shapes depending on
// the beta revision — a top-level `usage`, one inside `event.data`, or one
// nested on `agent.message` content blocks. Sniff all three per event.
// Cache tokens (creation + read) count as input — otherwise we undercount
// heavily on cached sessions.
function readUsageInput(u: Record<string, unknown>): number {
  const base = (u.input_tokens ?? u.prompt_tokens) as number | undefined;
  const cacheCreate = u.cache_creation_input_tokens as number | undefined;
  const cacheRead = u.cache_read_input_tokens as number | undefined;
  return (typeof base === "number" ? base : 0)
    + (typeof cacheCreate === "number" ? cacheCreate : 0)
    + (typeof cacheRead === "number" ? cacheRead : 0);
}

function addUsage(target: Usage, event: Record<string, unknown>): void {
  const candidates: Array<Record<string, unknown> | undefined> = [
    event.usage as Record<string, unknown> | undefined,
    (event.data as Record<string, unknown> | undefined)?.usage as Record<string, unknown> | undefined,
  ];
  const content = event.content as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(content)) {
    for (const block of content) {
      candidates.push(block?.usage as Record<string, unknown> | undefined);
    }
  }
  for (const u of candidates) {
    if (!u || typeof u !== "object") continue;
    const outTok = (u.output_tokens ?? u.completion_tokens) as number | undefined;
    target.input += readUsageInput(u);
    if (typeof outTok === "number") target.output += outTok;
  }
}

// Fallback: aggregate usage from the session detail endpoint. Different
// Managed Agents beta revisions surface it under `usage`, `total_usage`,
// `token_usage`, or nested inside `metadata`.
async function fetchSessionUsage(sessionId: string, apiKey: string): Promise<Usage | null> {
  try {
    const res = await fetch(`https://api.anthropic.com/v1/sessions/${sessionId}`, {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": AGENT_BETA,
      },
    });
    if (!res.ok) {
      console.error("[usage] session detail fetch failed:", res.status);
      return null;
    }
    const body = await res.json();
    console.error("[usage] session detail keys:", Object.keys(body));
    console.error("[usage] session detail body (first 500):", JSON.stringify(body).slice(0, 500));
    const candidates: Array<Record<string, unknown> | undefined> = [
      body.usage,
      body.total_usage,
      body.token_usage,
      body.metadata?.usage,
    ];
    for (const u of candidates) {
      if (!u || typeof u !== "object") continue;
      const outTok = (u.output_tokens ?? u.completion_tokens) as number | undefined;
      const inTok = readUsageInput(u as Record<string, unknown>);
      if (inTok > 0 || typeof outTok === "number") {
        return { input: inTok, output: outTok ?? 0 };
      }
    }
    return null;
  } catch (err) {
    console.error("[usage] session detail threw:", err);
    return null;
  }
}

async function extractHtmlFromSession(sessionId: string, apiKey: string): Promise<{ html: string; usage: Usage }> {
  console.error("[extract] fetching events for completed session:", sessionId);

  const headers = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": AGENT_BETA,
  };

  let finalHtml = "";
  const usage: Usage = { input: 0, output: 0 };
  let afterId: string | undefined;
  let page = 0;

  while (true) {
    page++;
    const url = new URL(`https://api.anthropic.com/v1/sessions/${sessionId}/events`);
    url.searchParams.set("limit", "100");
    if (afterId) url.searchParams.set("after_id", afterId);

    console.error(`[extract] page ${page} — GET`, url.toString());
    const res = await fetch(url.toString(), { headers });
    console.error(`[extract] page ${page} — status:`, res.status);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[extract] page ${page} — error body:`, errBody);
      throw new Error(`Events fetch failed: ${res.status} — ${errBody}`);
    }

    const body = await res.json();
    console.error(`[extract] page ${page} — raw response keys:`, Object.keys(body));
    console.error(`[extract] page ${page} — full response:`, JSON.stringify(body).slice(0, 500));

    const events: Array<Record<string, unknown>> = body.events ?? body.data ?? [];
    console.error(`[extract] page ${page} — event count:`, events.length, "has_more:", body.has_more);

    for (const event of events) {
      console.error("[extract] event type:", event.type, "id:", event.id);
      addUsage(usage, event);
      if (event.type === "agent.message") {
        finalHtml = "";
        for (const block of ((event.content ?? []) as Array<Record<string, unknown>>)) {
          if (block.type === "text") finalHtml += block.text as string;
        }
        console.error("[extract] agent.message html length:", finalHtml.length);
      }
    }

    if (!body.has_more || events.length === 0) break;
    afterId = events[events.length - 1]?.id as string | undefined;
    if (!afterId || page >= 20) break;
  }

  console.error("[extract] done — finalHtml length:", finalHtml.length, "usage:", usage.input, "/", usage.output);
  return { html: finalHtml, usage };
}

serve(async (req) => {
  console.error("[webhook] ===== NEW REQUEST =====");
  console.error("[webhook] method:", req.method);

  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  const rawBody = await req.text();
  console.error("[webhook] body length:", rawBody.length);
  console.error("[webhook] body:", rawBody);

  const sigHeader = req.headers.get("webhook-signature");
  const webhookId = req.headers.get("webhook-id");
  const webhookTs = req.headers.get("webhook-timestamp");
  const secret = Deno.env.get("ANTHROPIC_WEBHOOK_SECRET") ?? "";

  console.error("[webhook] webhook-id:", webhookId, "webhook-timestamp:", webhookTs);
  console.error("[webhook] ANTHROPIC_WEBHOOK_SECRET set:", !!secret, "length:", secret.length);
  console.error("[webhook] ANTHROPIC_API_KEY set:", !!Deno.env.get("ANTHROPIC_API_KEY"));

  const valid = await verifySignature(rawBody, sigHeader, webhookId, webhookTs, secret).catch((err) => {
    console.error("[webhook] verifySignature threw:", err);
    return false;
  });

  if (!valid) {
    console.error("[webhook] signature INVALID — returning 401");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  console.error("[webhook] signature OK");

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error("[webhook] JSON parse failed:", err);
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  console.error("[webhook] event.type:", event.type);
  console.error("[webhook] event.data:", JSON.stringify(event.data));

  // Anthropic wraps every webhook as { type: "event", data: { type: "...", id: "sesn_..." } }
  const data = event.data as Record<string, unknown> | undefined;
  const eventType = data?.type as string | undefined;

  console.error("[webhook] inner eventType:", eventType);

  if (eventType !== "session.status_idled") {
    console.error("[webhook] not a terminal event — ACKing");
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  console.error("[webhook] TERMINAL EVENT — processing session");

  const sessionId = data?.id as string | undefined;
  console.error("[webhook] sessionId:", sessionId);

  if (!sessionId) {
    console.error("[webhook] no sessionId in data — ACKing");
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  console.error("[webhook] querying ai_edit_jobs for session_id:", sessionId);
  const { data: job, error: jobError } = await admin
    .from("ai_edit_jobs")
    .select("id, user_id, space_id, instruction, html_url, status, model_id, request_id, credits_reserved")
    .eq("session_id", sessionId)
    .maybeSingle();

  console.error("[webhook] job query result:", JSON.stringify(job), "error:", jobError);

  if (!job) {
    console.error("[webhook] no job found for session_id:", sessionId);
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }
  if (job.status === "done" || job.status === "error") {
    console.error("[webhook] job already in terminal state:", job.status, "— skipping");
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  console.error("[webhook] processing job:", job.id, "space:", job.space_id, "status:", job.status);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

  try {
    console.error("[webhook] calling extractHtmlFromSession...");
    const extracted = await extractHtmlFromSession(sessionId, apiKey);
    let html = extracted.html;
    const usage = extracted.usage;
    console.error("[webhook] raw html length:", html.length);

    // Strip code fences in case the agent ignored the no-fences instruction
    const codeBlockMatch = html.match(/```html?\s*([\s\S]*?)```/i);
    if (codeBlockMatch) html = codeBlockMatch[1].trim();
    else html = html.trim();

    console.error("[webhook] html after strip length:", html.length, "preview:", html.slice(0, 200));

    console.error("[webhook] html after strip FULL:", html);
    const htmlValid = isLikelyValidHtml(html);
    console.error("[webhook] isLikelyValidHtml:", htmlValid,
      "| len>50:", html.trim().length > 50,
      "| has <html:", html.includes("<html"),
      "| has </html>:", html.includes("</html>"),
      "| has <body:", html.includes("<body"),
    );

    if (!htmlValid) {
      console.error("[webhook] invalid HTML — setting job to error");
      await admin.from("ai_edit_jobs").update({ status: "error", error_code: "ai_invalid_output" }).eq("id", job.id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Restore base64 assets from original HTML
    const marker = "/space-html/";
    const cleanUrl = (job.html_url as string).split("?")[0];
    const markerIdx = cleanUrl.indexOf(marker);
    console.error("[webhook] html_url:", job.html_url, "cleanUrl:", cleanUrl, "markerIdx:", markerIdx);

    if (markerIdx !== -1) {
      const storagePath = cleanUrl.slice(markerIdx + marker.length);
      console.error("[webhook] downloading original from storage path:", storagePath);
      const { data: blob, error: storageErr } = await admin.storage.from("space-html").download(storagePath);
      console.error("[webhook] storage download — blob present:", !!blob, "error:", storageErr);
      if (blob) {
        const rawHtml = await blob.text();
        const { manifest } = stripBase64Assets(rawHtml);
        const assetCount = Object.keys(manifest).length;
        console.error("[webhook] stripped", assetCount, "base64 assets from original HTML");
        html = restoreBase64Assets(html, manifest);
        console.error("[webhook] html after restoreBase64Assets length:", html.length);
      }
    }

    console.error("[webhook] updating job to done, result_html length:", html.length);
    const { error: updateErr } = await admin
      .from("ai_edit_jobs")
      .update({ status: "done", result_html: html })
      .eq("id", job.id);
    console.error("[webhook] job update error:", updateErr);

    // Charge credits — best effort so a failure here can't mask the ready
    // banner. Idempotent via request_id (charge_llm_usage skips repeats).
    //
    // Session-detail usage is the source of truth: it returns cumulative
    // totals including cache_creation/cache_read input tokens, whereas
    // per-event `usage` blocks under-report on Managed Agents (they surface
    // only the uncached delta, missing everything the session read from
    // cache — which for a warm system prompt is the bulk of input). Fall
    // back to the event-aggregated tally only if session detail is missing.
    const detailUsage = await fetchSessionUsage(sessionId, apiKey);
    let finalUsage = detailUsage ?? usage;
    if (detailUsage) {
      console.error(
        "[webhook] session-detail usage:", detailUsage.input, "/", detailUsage.output,
        "— event-aggregated was:", usage.input, "/", usage.output,
      );
    } else {
      console.error("[webhook] session detail unavailable — falling back to event aggregation:", usage.input, "/", usage.output);
    }

    if (job.model_id && job.request_id && (finalUsage.input + finalUsage.output > 0)) {
      const { data: charged, error: chargeErr } = await admin.rpc("charge_llm_usage", {
        p_user_id:          job.user_id,
        p_model_id:         job.model_id,
        p_role:             "page_editor",
        p_input_tokens:     finalUsage.input,
        p_output_tokens:    finalUsage.output,
        p_message_id:       null,
        p_request_id:       job.request_id,
        p_space_id:         job.space_id,
        p_credits_reserved: job.credits_reserved ?? 0,
      });
      if (chargeErr) console.error("[webhook] charge_llm_usage error:", chargeErr);
      else console.error("[webhook] charged", charged, "credits for", finalUsage.input, "/", finalUsage.output, "tokens (reserved:", job.credits_reserved ?? 0, ")");
    } else {
      console.error("[webhook] skipping charge — missing", {
        model_id: !!job.model_id,
        request_id: !!job.request_id,
        usage_total: finalUsage.input + finalUsage.output,
      });
    }

    console.error("[webhook] fetching space:", job.space_id);
    const { data: space, error: spaceErr } = await admin
      .from("spaces")
      .select("title, profiles!inner(username)")
      .eq("id", job.space_id)
      .single();
    console.error("[webhook] space query result:", JSON.stringify(space), "error:", spaceErr);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ownerUsername = (space as any)?.profiles?.username ?? "";
    console.error("[webhook] ownerUsername:", ownerUsername);

    const notifPayload = {
      user_id: job.user_id,
      type: "ai_edit_ready",
      payload: {
        space_id: job.space_id,
        space_title: space?.title ?? "your space",
        space_owner_username: ownerUsername,
        job_id: job.id,
        instruction: (job.instruction as string).slice(0, 100),
      },
    };
    console.error("[webhook] inserting notification:", JSON.stringify(notifPayload));
    const { error: notifErr } = await admin.from("notifications").insert(notifPayload);
    console.error("[webhook] notification insert error:", notifErr);

    console.error("[webhook] ALL DONE — job", job.id, "complete");
  } catch (err) {
    console.error("[webhook] UNCAUGHT ERROR:", err instanceof Error ? err.stack : err);
    const { error: updateErr } = await admin
      .from("ai_edit_jobs")
      .update({ status: "error", error_code: "ai_unavailable" })
      .eq("id", job.id);
    console.error("[webhook] error status update error:", updateErr);
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
