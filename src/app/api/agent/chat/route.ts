import { NextRequest } from "next/server";

// Thin proxy → Supabase Edge Function (agent-chat).
// All business logic lives in supabase/functions/agent-chat/index.ts:
//   quota enforcement, RAG retrieval, system prompt assembly, Claude streaming.

export async function POST(req: NextRequest) {
  const body = await req.text();

  const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/agent-chat`;

  const upstream = await fetch(edgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
