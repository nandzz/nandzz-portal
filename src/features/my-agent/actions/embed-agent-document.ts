"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const embedAgentDocumentSchema = z.object({ id: z.uuid() });

export type EmbedAgentDocumentResult =
  | { ok: true }
  | { ok: false; error: "UNAUTHENTICATED" | "INVALID_INPUT" | "FAILED"; message?: string };

// Kick off (re)embedding of a document. Ownership is verified here; the actual
// chunking + embedding + DB writes happen in the `embed-document` edge function.
// Callers fire-and-forget after a create/update.
export async function embedAgentDocument(
  id: string
): Promise<EmbedAgentDocumentResult> {
  const parsed = embedAgentDocumentSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed-document`;

  try {
    const upstream = await fetch(edgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ document_id: parsed.data.id, user_id: user.id }),
    });
    if (!upstream.ok) {
      return { ok: false, error: "FAILED", message: `edge ${upstream.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "FAILED", message: (e as Error).message };
  }
}
