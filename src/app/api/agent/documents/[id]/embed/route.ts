import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunkDocument } from "@/lib/agent/chunker";
import { embedBatch } from "@/lib/agent/embeddings";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch the document, verifying ownership.
  const { data: doc, error: docError } = await supabase
    .from("agent_documents")
    .select("id, title, content, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // 1. Chunk the content.
  const chunks = chunkDocument(doc.title, doc.content);

  // 2. Embed all chunks in one batch (null entries when no API key).
  const embeddings = await embedBatch(chunks);

  // 3. Replace old chunks for this document.
  const admin = createAdminClient();
  await admin
    .from("agent_document_chunks")
    .delete()
    .eq("document_id", doc.id);

  if (chunks.length === 0) {
    return NextResponse.json({ chunked: 0, embedded: 0 });
  }

  // 4. Insert new chunks (with or without embeddings).
  const rows = chunks.map((content, i) => ({
    document_id: doc.id,
    user_id: doc.user_id,
    chunk_index: i,
    content,
    embedding: embeddings[i] ?? null,
  }));

  const { error: insertError } = await admin
    .from("agent_document_chunks")
    .insert(rows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const embedded = embeddings.filter(Boolean).length;
  return NextResponse.json({ chunked: chunks.length, embedded });
}
