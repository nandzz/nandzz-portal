import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_INSTRUCTION_CHARS = 500;
const MAX_ATTACHMENTS = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB base64-encoded ceiling
const MAX_TEXT_CHARS = 50_000;
// Refuse the request if the caller has fewer than this many paid_credits.
// A single AI edit round-trip on claude-sonnet-4-6 (0.90/4.50 per 1k) with
// a typical page + instruction (~5k in / ~2k out) bills roughly 14 credits.
// Sized to cover one full edit plus a small buffer — anything lower lets
// users trigger a session they can't pay for. Concurrent edits can still
// race this check; a proper reservation/hold is a follow-up.
const MIN_CREDITS_FOR_AI_EDIT = 20;

type FileAttachment = {
  name: string;
  type: "text" | "binary";
  content?: string;   // text files
  data?: string;      // base64, binary files
  mediaType?: string; // MIME type for binary files
};

function validateAttachments(raw: unknown): FileAttachment[] | null {
  if (!raw) return [];
  if (!Array.isArray(raw) || raw.length > MAX_ATTACHMENTS) return null;
  for (const a of raw) {
    if (typeof a?.name !== "string") return null;
    if (!["text", "binary"].includes(a?.type)) return null;
    if (a.type === "text" && typeof a.content !== "string") return null;
    if (a.type === "binary" && typeof a.data !== "string") return null;
    // Rough size guard — base64 is ~1.33× the original binary size
    const size = a.type === "text" ? (a.content?.length ?? 0) : Math.ceil((a.data?.length ?? 0) * 0.75);
    if (size > MAX_FILE_BYTES) return null;
    // Truncate text content server-side
    if (a.type === "text" && a.content.length > MAX_TEXT_CHARS) {
      a.content = a.content.slice(0, MAX_TEXT_CHARS) + "\n…[truncated]";
    }
  }
  return raw as FileAttachment[];
}

async function fireEdgeFunction(jobId: string) {
  const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/space-ai-edit`;
  await fetch(edgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ jobId }),
  }).catch((err) => console.error("[ai-edit] edge function fire failed", err));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await params;
  const body = await req.json().catch(() => ({}));
  const { instruction, htmlUrl, attachments: rawAttachments } = body;

  console.log("[ai-edit] POST", { spaceId, instructionLength: instruction?.length });

  if (!instruction || typeof instruction !== "string" || instruction.trim().length === 0) {
    return NextResponse.json({ error: "Instruction is required" }, { status: 400 });
  }
  if (instruction.length > MAX_INSTRUCTION_CHARS) {
    return NextResponse.json({ error: "Instruction too long" }, { status: 400 });
  }
  if (!htmlUrl || typeof htmlUrl !== "string") {
    return NextResponse.json({ error: "htmlUrl is required" }, { status: 400 });
  }

  const attachments = validateAttachments(rawAttachments);
  if (attachments === null) {
    return NextResponse.json({ error: "Invalid attachments" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user) {
    console.error("[ai-edit] auth failed", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: space, error: spaceError } = await admin
    .from("spaces")
    .select("user_id")
    .eq("id", spaceId)
    .single();

  if (!space || space.user_id !== user.id) {
    console.error("[ai-edit] ownership check failed", { space, spaceError, userId: user.id });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Model lookup (credit reservation happens next via RPC).
  const { data: modelRow } = await admin
    .from("llm_models")
    .select("id")
    .eq("default_for_role", "page_editor")
    .eq("active", true)
    .maybeSingle();

  if (!modelRow) {
    console.error("[ai-edit] no active page_editor model configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const requestId = crypto.randomUUID();

  // Atomic reserve — combines the balance check and the debit so concurrent
  // requests can't each pass a stale pre-check on the same balance. The hold
  // is released either by charge_llm_usage on success or by the
  // ai_edit_jobs status-error trigger on failure.
  const { error: reserveErr } = await admin.rpc("reserve_llm_credits", {
    p_user_id:    user.id,
    p_amount:     MIN_CREDITS_FOR_AI_EDIT,
    p_request_id: requestId,
  });
  if (reserveErr) {
    if ((reserveErr.message ?? "").includes("INSUFFICIENT_CREDITS")) {
      return NextResponse.json(
        { error: "INSUFFICIENT_CREDITS", buy_url: "/dashboard/credits" },
        { status: 402 }
      );
    }
    console.error("[ai-edit] reserve_llm_credits failed", reserveErr);
    return NextResponse.json({ error: "Failed to reserve credits" }, { status: 500 });
  }

  // Create the job row
  const { data: job, error: jobError } = await admin
    .from("ai_edit_jobs")
    .insert({
      space_id: spaceId,
      user_id: user.id,
      instruction,
      html_url: htmlUrl,
      model_id: modelRow.id,
      request_id: requestId,
      credits_reserved: MIN_CREDITS_FOR_AI_EDIT,
      ...(attachments.length > 0 && { file_context: attachments }),
    })
    .select("id")
    .single();

  if (!job || jobError) {
    console.error("[ai-edit] job creation failed", jobError);
    // Release the hold so the user isn't charged for a job that never ran.
    await admin.rpc("refund_llm_reservation", {
      p_user_id:    user.id,
      p_amount:     MIN_CREDITS_FOR_AI_EDIT,
      p_request_id: requestId,
    });
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }

  console.log("[ai-edit] job created", job.id, "request", requestId);

  // Fire edge function after the response is sent
  after(fireEdgeFunction(job.id));

  return NextResponse.json({ jobId: job.id });
}
