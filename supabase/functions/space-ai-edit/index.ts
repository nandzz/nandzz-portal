import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_STRIPPED_BYTES = 500_000;
const AGENT_BETA = "managed-agents-2026-04-01";

type AssetManifest = Record<string, string>;

type FileAttachment = {
  name: string;
  type: "text" | "binary";
  content?: string;   // text files
  data?: string;      // base64, binary files
  mediaType?: string; // MIME type for binary files
};

function stripBase64Assets(html: string): { stripped: string; manifest: AssetManifest } {
  const manifest: AssetManifest = {};
  let idx = 0;
  const stripped = html.replace(/(src|href)="(data:[^;]+;base64,[^"]+)"/gi, (_m, attr, uri) => {
    const key = `ASSET_PLACEHOLDER_${idx++}`;
    manifest[key] = uri;
    return `${attr}="data:${key}"`;
  });
  return { stripped, manifest };
}

// Starts an Anthropic agent session for the given job and returns immediately.
// The agent runs on Anthropic's servers; we receive the result via webhook
// (POST /api/webhooks/anthropic) when the session reaches status_idle.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const { jobId } = await req.json().catch(() => ({}));
  if (!jobId) {
    return new Response(JSON.stringify({ error: "Missing jobId" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const agentId = Deno.env.get("ANTHROPIC_AGENT_ID");
  const environmentId = Deno.env.get("ANTHROPIC_ENVIRONMENT_ID");
  if (!apiKey || !agentId || !environmentId) {
    return new Response(JSON.stringify({ error: "Missing Anthropic secrets" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Resolve caller from the forwarded user JWT. verify_jwt=true only proves
  // the token is signed by Supabase (any anon/user token qualifies), so we
  // must additionally check the caller owns the job.
  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  const { data: { user: caller } } = jwt
    ? await admin.auth.getUser(jwt)
    : { data: { user: null } };

  if (!caller) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { data: job, error: jobErr } = await admin
    .from("ai_edit_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  // Collapse "not found" and "not yours" into a single 404 so callers can't
  // enumerate job IDs by observing the status code.
  if (!job || jobErr || job.user_id !== caller.id) {
    console.error("[space-ai-edit] job not accessible", jobId, jobErr, caller.id);
    return new Response(JSON.stringify({ error: "Job not found" }), {
      status: 404, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (job.status === "done" || job.status === "error") {
    return new Response("already complete", { status: 200, headers: CORS });
  }

  async function updateJob(data: Record<string, unknown>) {
    await admin.from("ai_edit_jobs").update(data).eq("id", jobId);
  }

  const anthropicHeaders = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": `${AGENT_BETA},files-api-2025-04-14`,
    "content-type": "application/json",
  };

  try {
    await updateJob({ status: "processing", status_text: "Reading your page…" });

    // Extract storage path and fetch HTML
    const marker = "/space-html/";
    const cleanUrl = (job.html_url as string).split("?")[0];
    const markerIdx = cleanUrl.indexOf(marker);
    if (markerIdx === -1) {
      await updateJob({ status: "error", error_code: "html_not_found" });
      return new Response("ok", { status: 200, headers: CORS });
    }
    const storagePath = cleanUrl.slice(markerIdx + marker.length);

    const { data: blob, error: fetchErr } = await admin.storage
      .from("space-html")
      .download(storagePath);

    if (fetchErr || !blob) {
      console.error("[space-ai-edit] storage download failed", storagePath, fetchErr);
      await updateJob({ status: "error", error_code: "html_not_found" });
      return new Response("ok", { status: 200, headers: CORS });
    }

    const rawHtml = await blob.text();
    const { stripped } = stripBase64Assets(rawHtml);

    if (new TextEncoder().encode(stripped).length > MAX_STRIPPED_BYTES) {
      await updateJob({ status: "error", error_code: "html_too_large" });
      return new Response("ok", { status: 200, headers: CORS });
    }

    await updateJob({ status_text: "Sending to AI…" });

    // ── Step 1: Upload attached files to the Anthropic Files API ─────────────
    // Each file gets a file_id which is then mounted into the session at
    // /mnt/session/uploads/<filename> via the resources array on session create.
    // Files API uses a different beta header than the Sessions API.
    const attachedFiles = (job.file_context ?? []) as FileAttachment[];

    type FileResource = { type: "file"; file_id: string; mount_path: string };
    const resources: FileResource[] = [];

    for (const file of attachedFiles) {
      try {
        let fileBlob: Blob;
        if (file.type === "text" && file.content) {
          fileBlob = new Blob([file.content], { type: "text/plain" });
        } else if (file.type === "binary" && file.data) {
          const binary = atob(file.data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          fileBlob = new Blob([bytes], { type: file.mediaType ?? "application/octet-stream" });
        } else {
          continue;
        }

        const form = new FormData();
        form.append("file", fileBlob, file.name);

        const uploadRes = await fetch("https://api.anthropic.com/v1/files", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "files-api-2025-04-14",
          },
          body: form,
        });

        if (!uploadRes.ok) {
          const errBody = await uploadRes.text().catch(() => "");
          console.error("[space-ai-edit] file upload failed:", file.name, uploadRes.status, errBody.slice(0, 200));
          continue;
        }

        const { id: fileId } = await uploadRes.json();
        resources.push({ type: "file", file_id: fileId, mount_path: `/mnt/session/uploads/${file.name}` });
        console.log("[space-ai-edit] file uploaded:", file.name, "->", fileId);
      } catch (err) {
        console.error("[space-ai-edit] file upload error:", file.name, err);
      }
    }

    // ── Step 2: Create session, mounting uploaded files ───────────────────────
    const sessionRes = await fetch("https://api.anthropic.com/v1/sessions", {
      method: "POST",
      headers: anthropicHeaders,
      body: JSON.stringify({
        agent: agentId,
        environment_id: environmentId,
        ...(resources.length > 0 && { resources }),
      }),
    });

    if (!sessionRes.ok) {
      const body = await sessionRes.text().catch(() => "");
      console.error("[space-ai-edit] session creation failed", sessionRes.status, body);
      await updateJob({ status: "error", error_code: "ai_unavailable" });
      return new Response("ok", { status: 200, headers: CORS });
    }

    const { id: sessionId } = await sessionRes.json();
    await updateJob({ session_id: sessionId, status_text: "Working on it…" });

    const filesNote = resources.length > 0
      ? `\n\nAttached files are mounted at /mnt/session/uploads:\n${resources.map((r) => `- ${r.mount_path.split("/").pop()}`).join("\n")}`
      : "";

    // Send the user message — agent processes asynchronously on Anthropic's servers.
    // Result arrives via POST /api/webhooks/anthropic when session.status_idled fires.
    const msgRes = await fetch(
      `https://api.anthropic.com/v1/sessions/${sessionId}/events`,
      {
        method: "POST",
        headers: anthropicHeaders,
        body: JSON.stringify({
          events: [{
            type: "user.message",
            content: [{
              type: "text",
              text: `You must respond with ONLY the complete HTML document — no explanations, no markdown, no code fences, no commentary before or after. Start your response with <!DOCTYPE html> and end with </html>.

Current HTML:
${stripped}

Instruction: ${job.instruction}${filesNote}`,
            }],
          }],
        }),
      }
    );

    if (!msgRes.ok) {
      const body = await msgRes.text().catch(() => "");
      console.error("[space-ai-edit] send message failed", msgRes.status, body);
      await updateJob({ status: "error", error_code: "ai_unavailable" });
      return new Response("ok", { status: 200, headers: CORS });
    }

    // Session is now running on Anthropic's servers. This function returns immediately.
    // The webhook handler will receive the result and complete the job.
    console.log("[space-ai-edit] session started", sessionId, "for job", jobId);
  } catch (err) {
    console.error("[space-ai-edit] error:", err instanceof Error ? err.message : err);
    await updateJob({ status: "error", error_code: "ai_unavailable" });
  }

  return new Response("ok", { status: 200, headers: CORS });
});
