"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PublishSpacePayload = {
  title: string;
  description?: string | null;
  url?: string | null;
  html_url?: string | null;
  pdf_url?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  markdown_content?: string | null;
  preview_image_url?: string | null;
  preview_gradient?: string | null;
  preview_title?: string | null;
  is_public?: boolean;
  hashtags?: string[];
};

// Only error results are returned to the client. On success the action
// calls redirect() and never returns.
export type PublishSpaceError = {
  ok: false;
  error: "INSUFFICIENT_CREDITS" | "UNAUTHENTICATED" | "FAILED";
  message?: string;
};

export async function publishSpace(
  payload: PublishSpacePayload,
  clientRequestId: string,
  collectionId?: string
): Promise<PublishSpaceError | void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase.rpc("publish_space_tx", {
    p_user_id: user.id,
    p_space_payload: payload,
    p_client_request_id: clientRequestId,
  });

  if (error) {
    if (error.message?.includes("INSUFFICIENT_CREDITS")) {
      return { ok: false, error: "INSUFFICIENT_CREDITS" };
    }
    return { ok: false, error: "FAILED", message: error.message };
  }

  // RPC returns a single row (RETURNS TABLE).
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.space_id) {
    return { ok: false, error: "FAILED", message: "no space_id returned" };
  }

  if (collectionId) {
    await supabase
      .from("collection_spaces")
      .insert({ collection_id: collectionId, space_id: row.space_id });
  }

  // Server-side redirect — recommended pattern for post-mutation navigation
  // in Next.js server actions. Throws NEXT_REDIRECT which Next.js turns into
  // a 303 the client always honors; avoids the router.push race with the
  // enclosing server-action transition.
  redirect(collectionId ? `/dashboard/collections/${collectionId}` : "/dashboard");
}
