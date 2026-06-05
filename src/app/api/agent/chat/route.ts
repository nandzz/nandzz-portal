import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Thin proxy → Supabase Edge Function (agent-chat).
// All business logic lives in supabase/functions/agent-chat/index.ts:
//   quota enforcement, RAG retrieval, system prompt assembly, Claude streaming.
//
// mode is resolved server-side: "owner" only when the authenticated session
// user is the actual profile owner. Never trusted from the client body.

const MAX_MESSAGE_CHARS = 1000;

export async function POST(req: NextRequest) {
  const { messages, username, preview } = await req.json();

  // Reject if any message exceeds the character limit.
  if (
    !Array.isArray(messages) ||
    messages.some((m) => typeof m.content === "string" && m.content.length > MAX_MESSAGE_CHARS)
  ) {
    return new Response(JSON.stringify({ error: "Message too long" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Determine mode server-side.
  // "owner" requires: authenticated session user === profile owner AND preview !== true.
  // preview=true lets the owner force visitor mode (e.g. the preview page).
  let mode: "visitor" | "owner" = "visitor";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user && !preview) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .single();

    if (profile?.id === user.id) {
      mode = "owner";
    }
  }

  const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/agent-chat`;

  const upstream = await fetch(edgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ messages, username, mode }),
  });

  const streamHeaders = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
  };

  if (!upstream.ok) {
    const enc = new TextEncoder();
    return new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(enc.encode(JSON.stringify({ content: "Something went wrong. Please try again." }) + "\n"));
          c.enqueue(enc.encode(JSON.stringify({ done: true }) + "\n"));
          c.close();
        },
      }),
      { headers: streamHeaders }
    );
  }

  return new Response(upstream.body, { headers: streamHeaders });
}
