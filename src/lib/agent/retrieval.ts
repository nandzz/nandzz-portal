import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedText } from "./embeddings";

/**
 * Retrieve the most relevant chunks for a query using cosine similarity.
 *
 * Returns an array of chunk content strings ordered by relevance.
 * Returns an empty array when:
 *   - OPENAI_API_KEY is not set (no embeddings exist)
 *   - The query embedding fails
 *   - No chunks have been embedded yet
 *
 * Callers should fall back to full-document injection when the result is empty.
 */
export async function retrieveChunks(
  userId: string,
  query: string,
  topK = 6
): Promise<string[]> {
  const queryEmbedding = await embedText(query);
  if (!queryEmbedding) return [];

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("match_agent_chunks", {
    p_user_id: userId,
    p_embedding: queryEmbedding,
    p_top_k: topK,
  });

  if (error || !data) return [];
  return (data as { content: string; similarity: number }[]).map((r) => r.content);
}
