const MAX_CHUNK_CHARS = 1_500; // ~375 words — safe for text-embedding-3-small

/**
 * Splits a markdown document into chunks suitable for embedding.
 * Strategy:
 *   1. Split on markdown headers (##, ###) — each section = one chunk.
 *   2. If a section exceeds MAX_CHUNK_CHARS, split further by blank lines.
 *   3. Every chunk is prefixed with the document title so the LLM knows
 *      where the content comes from during retrieval.
 */
export function chunkDocument(title: string, content: string): string[] {
  const prefix = `[${title}]\n\n`;
  const chunks: string[] = [];

  // Split before each header line, keeping the header with its content.
  const sections = content.split(/\n(?=#{1,3} )/);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    if (trimmed.length <= MAX_CHUNK_CHARS) {
      chunks.push(prefix + trimmed);
    } else {
      // Section too long — split by paragraph breaks.
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

  // Entire document has no headers and fits in one chunk.
  if (chunks.length === 0 && content.trim()) {
    chunks.push(prefix + content.trim());
  }

  return chunks;
}
