import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function fireEdgeFunction(jobId: string) {
  const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/space-ai-edit`;
  await fetch(edgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ jobId }),
  }).catch((err) => console.error("[ai-edit] resume fire failed", err));
}

// GET /api/spaces/[spaceId]/ai-edit/[jobId]
// Called by the client to trigger a resume when the edge function timed out mid-session.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ spaceId: string; jobId: string }> }
) {
  const { spaceId, jobId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: job } = await admin
    .from("ai_edit_jobs")
    .select("user_id, space_id, status, session_id")
    .eq("id", jobId)
    .single();

  if (!job || job.user_id !== user.id || job.space_id !== spaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only resume jobs that are stuck in processing and have a session to reconnect to
  if (job.status === "processing" && job.session_id) {
    console.log("[ai-edit] resuming job", jobId, "session", job.session_id);
    after(fireEdgeFunction(jobId));
  }

  return NextResponse.json({ status: job.status });
}
