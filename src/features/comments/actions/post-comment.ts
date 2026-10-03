"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import type { CommentWithLike } from "@/lib/types";
import { postCommentSchema } from "../schemas";
import { parseMentions } from "../mentions";

export type PostCommentResult =
  | { ok: true; comment: CommentWithLike }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "INVALID_INPUT" | "FAILED";
      message?: string;
    };

const COMMENT_SELECT = "*, profiles:user_id(username, display_name, avatar_url)";

// Posts a comment (parentId omitted) or a reply (parentId set). The insert is the
// user-facing result; @mention rows and notifications are best-effort after it.
// Owner/parent-author/commenter identities are resolved server-side rather than
// trusted from the client.
export async function postComment(input: {
  spaceId: string;
  content: string;
  parentId?: string | null;
}): Promise<PostCommentResult> {
  const parsed = postCommentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const { spaceId, content, parentId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { data, error } = await supabase
    .from("space_comments")
    .insert({ space_id: spaceId, user_id: user.id, content, parent_id: parentId ?? null })
    .select(COMMENT_SELECT)
    .single();

  if (error || !data) return { ok: false, error: "FAILED", message: error?.message };

  const comment = { ...(data as object), liked: false } as CommentWithLike;

  // --- best-effort mentions + notifications (never fail the post) ---
  try {
    const [{ data: space }, { data: commenter }] = await Promise.all([
      supabase.from("spaces").select("user_id, title").eq("id", spaceId).single(),
      supabase.from("profiles").select("username, display_name").eq("id", user.id).single(),
    ]);

    let ownerUsername = "";
    if (space?.user_id) {
      const { data: owner } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", space.user_id)
        .single();
      ownerUsername = owner?.username ?? "";
    }

    const payload = {
      space_id: spaceId,
      space_title: space?.title ?? "",
      space_owner_username: ownerUsername,
      commenter_username: commenter?.username ?? "",
      commenter_display_name: commenter?.display_name ?? null,
      comment_preview: content.slice(0, 100),
    };

    const notified = new Set<string>([user.id]);

    // Notifications target other users, so they go through the service role
    // (the notifications table has no user-facing INSERT policy).
    const admin = createAdminClient();
    if (parentId) {
      // Reply: notify the parent comment's author.
      const { data: parent } = await supabase
        .from("space_comments")
        .select("user_id")
        .eq("id", parentId)
        .single();
      if (parent?.user_id && !notified.has(parent.user_id)) {
        notified.add(parent.user_id);
        await createNotification(admin, parent.user_id, "new_reply", payload);
      }
    } else if (space?.user_id && space.user_id !== user.id) {
      // Top-level: notify the space owner.
      notified.add(space.user_id);
      await createNotification(admin, space.user_id, "new_comment", payload);
    }

    const mentioned = parseMentions(content);
    if (mentioned.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("username", mentioned);
      if (profiles?.length) {
        await supabase.from("comment_mentions").insert(
          profiles.map((p) => ({ comment_id: data.id, mentioned_user_id: p.id }))
        );
        for (const p of profiles) {
          if (!notified.has(p.id)) {
            notified.add(p.id);
            await createNotification(admin, p.id, "comment_mention", payload);
          }
        }
      }
    }
  } catch {
    // Notifications are non-critical; the comment is already saved.
  }

  return { ok: true, comment };
}
