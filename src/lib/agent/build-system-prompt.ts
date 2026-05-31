import fs from "fs";
import path from "path";

const template = fs.readFileSync(
  path.join(process.cwd(), "src/lib/agent/system-prompt.md"),
  "utf-8"
);

/**
 * Full-document injection — used as fallback when embeddings are unavailable.
 * Injects every public active document in sort_order.
 */
export function buildSystemPrompt(
  name: string,
  docs: { title: string; content: string }[]
): string {
  const docsSection =
    docs.length === 0
      ? "_No public documents have been added yet. Be transparent about this if asked._"
      : docs
          .map((d) => `### ${d.title}\n\n${d.content.trim()}`)
          .join("\n\n---\n\n");

  return template
    .replace(/{{name}}/g, name)
    .replace("{{documents}}", docsSection);
}

/**
 * RAG variant — injects only the chunks retrieved by vector similarity.
 * Each chunk already carries its document title prefix from the chunker.
 */
export function buildSystemPromptFromChunks(
  name: string,
  chunks: string[]
): string {
  const docsSection =
    chunks.length === 0
      ? "_No relevant content found for this question._"
      : chunks.join("\n\n---\n\n");

  return template
    .replace(/{{name}}/g, name)
    .replace("{{documents}}", docsSection);
}
