import "server-only";

const OPENAI_URL = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

function apiKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null;
}

/**
 * Embed a single string.
 * Returns null when OPENAI_API_KEY is not set or the request fails.
 * Callers must handle null and fall back gracefully.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const key = apiKey();
  if (!key) return null;

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ input: text, model: MODEL }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data[0].embedding as number[];
  } catch {
    return null;
  }
}

/**
 * Embed a batch of strings in one API call.
 * Returns an array of the same length; each entry is null on failure.
 */
export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  const key = apiKey();
  if (!key) return texts.map(() => null);

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ input: texts, model: MODEL }),
    });
    if (!res.ok) return texts.map(() => null);
    const json = await res.json();
    // OpenAI returns results in the same order as input.
    return (json.data as { embedding: number[] }[]).map((d) => d.embedding);
  } catch {
    return texts.map(() => null);
  }
}
