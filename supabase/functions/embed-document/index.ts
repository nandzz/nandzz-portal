import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Chunker ──────────────────────────────────────────────────────────────────

const MAX_CHUNK_CHARS = 1_500;

function chunkDocument(title: string, content: string): string[] {
  const prefix = `[${title}]\n\n`;
  const chunks: string[] = [];
  const sections = content.split(/\n(?=#{1,3} )/);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    if (trimmed.length <= MAX_CHUNK_CHARS) {
      chunks.push(prefix + trimmed);
    } else {
      const paragraphs = trimmed.split(/\n\n+/);
      let current = "";
      for (const para of paragraphs) {
        const candidate = current ? current + "\n\n" + para : para;
        if (candidate.length > MAX_CHUNK_CHARS && current) {
          chunks.push(prefix + current.trim());
          current = para;
        } else {
          current = candidate;
        }
      }
      if (current.trim()) chunks.push(prefix + current.trim());
    }
  }

  if (chunks.length === 0 && content.trim()) {
    chunks.push(prefix + content.trim());
  }

  return chunks;
}

// ─── Embeddings ───────────────────────────────────────────────────────────────

async function embedBatch(texts: string[], apiKey: string): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
    });
    if (!res.ok) return texts.map(() => null);
    const json = await res.json();
    return (json.data as { embedding: number[] }[]).map((d) => d.embedding);
  } catch {
    return texts.map(() => null);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  let document_id: string;
  let user_id: string;

  try {
    ({ document_id, user_id } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!document_id || !user_id) {
    return new Response(JSON.stringify({ error: "document_id and user_id are required" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const openAIKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAIKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
      status: 503,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify the caller owns this document.
  const { data: doc, error: docError } = await admin
    .from("agent_documents")
    .select("id, title, content, user_id")
    .eq("id", document_id)
    .eq("user_id", user_id)
    .single();

  if (docError || !doc) {
    return new Response(JSON.stringify({ error: "Document not found" }), {
      status: 404,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const chunks = chunkDocument(doc.title, doc.content);

  const embeddings = await embedBatch(chunks, openAIKey);

  await admin.from("agent_document_chunks").delete().eq("document_id", doc.id);

  if (chunks.length === 0) {
    return new Response(JSON.stringify({ chunked: 0, embedded: 0 }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const rows = chunks.map((content, i) => ({
    document_id: doc.id,
    user_id: doc.user_id,
    chunk_index: i,
    content,
    embedding: embeddings[i] ?? null,
  }));

  const { error: insertError } = await admin.from("agent_document_chunks").insert(rows);

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const embedded = embeddings.filter(Boolean).length;
  return new Response(JSON.stringify({ chunked: chunks.length, embedded }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
