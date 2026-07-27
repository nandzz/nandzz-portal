import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAiEditQuota } from "@/lib/ai-edit-quota";

const MAX_INSTRUCTION_CHARS = 500;
const MAX_ATTACHMENTS = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB base64-encoded ceiling
const MAX_TEXT_CHARS = 50_000;

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

  const { data: profile } = await admin
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();

  const { allowed, remaining } = await checkAiEditQuota(user.id, profile?.plan_tier);
  console.log("[ai-edit] quota", { allowed, remaining });
  if (!allowed) {
    return NextResponse.json({ error: "quota_exceeded", remaining: 0 }, { status: 429 });
  }

  // Create the job row
  const { data: job, error: jobError } = await admin
    .from("ai_edit_jobs")
    .insert({
      space_id: spaceId,
      user_id: user.id,
      instruction,
      html_url: htmlUrl,
      ...(attachments.length > 0 && { file_context: attachments }),
    })
    .select("id")
    .single();

  if (!job || jobError) {
    console.error("[ai-edit] job creation failed", jobError);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }

  console.log("[ai-edit] job created", job.id, "remaining quota:", remaining);

  // Fire edge function after the response is sent
  after(fireEdgeFunction(job.id));

  return NextResponse.json({ jobId: job.id, remaining: remaining - 1 });
}
