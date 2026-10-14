"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  content_type?: string;
};

// Only error results are returned to the client. On success the action
// calls redirect() and never returns.
export type PublishSpaceError = {
  ok: false;
  // SPACE_LIMIT_REACHED ⇒ Free plan is at its space cap; the UI shows an
  // upgrade prompt. Publishing itself is free (no credit charge).
  error: "SPACE_LIMIT_REACHED" | "UNAUTHENTICATED" | "FAILED";
  message?: string;
};

/** Inserts one space via publish_space_tx (+ optional collection link) and
 * returns its id. Shared by the redirecting single publish and the batch item. */
async function insertSpace(
  payload: PublishSpacePayload,
  clientRequestId: string,
  collectionId?: string
): Promise<PublishSpaceError | { ok: true; spaceId: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  // publish_space_tx is service-role only; the caller is the verified session user.
  const { data, error } = await createAdminClient().rpc("publish_space_tx", {
    p_user_id: user.id,
    p_space_payload: payload,
    p_client_request_id: clientRequestId,
  });

  if (error) {
    if (error.message?.includes("SPACE_LIMIT_REACHED")) {
      return { ok: false, error: "SPACE_LIMIT_REACHED" };
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

  return { ok: true, spaceId: row.space_id as string };
}

export async function publishSpace(
  payload: PublishSpacePayload,
  clientRequestId: string,
  collectionId?: string
): Promise<PublishSpaceError | void> {
  const result = await insertSpace(payload, clientRequestId, collectionId);
  if (!result.ok) return result;

  // Server-side redirect — recommended pattern for post-mutation navigation
  // in Next.js server actions. Throws NEXT_REDIRECT which Next.js turns into
  // a 303 the client always honors; avoids the router.push race with the
  // enclosing server-action transition.
  redirect(collectionId ? `/dashboard/collections/${collectionId}` : "/dashboard/contents");
}

/** One item of a multi-publish (batch image upload). Same as `publishSpace`
 * but returns the new id instead of redirecting, so the client can publish
 * several in a row and navigate once at the end. Each item carries its own
 * stable clientRequestId, so a retried item resolves to the same row. */
export async function publishSpaceItem(
  payload: PublishSpacePayload,
  clientRequestId: string,
  collectionId?: string
): Promise<PublishSpaceError | { ok: true; spaceId: string }> {
  return insertSpace(payload, clientRequestId, collectionId);
}
