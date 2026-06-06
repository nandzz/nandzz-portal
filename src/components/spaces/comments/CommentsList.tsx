"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createNotification } from "@/lib/notifications";
import { CommentItem } from "./CommentItem";
import { CommentInput } from "./CommentInput";
import type { CommentWithLike } from "@/lib/types";

const PAGE_SIZE = 20;

interface CommentsListProps {
  spaceId: string;
  spaceOwnerId: string;
  spaceOwnerUsername: string;
  spaceTitle: string;
  initialComments: CommentWithLike[];
  initialHasMore: boolean;
  userId: string | null;
  currentProfile: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  onCountChange: (delta: number) => void;
}

export function CommentsList({
  spaceId,
  spaceOwnerId,
  spaceOwnerUsername,
  spaceTitle,
  initialComments,
  initialHasMore,
  userId,
  currentProfile,
  onCountChange,
}: CommentsListProps) {
  const [comments, setComments] = useState<CommentWithLike[]>(initialComments);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, startLoadMore] = useTransition();

  const loadMore = () => {
    const last = comments[comments.length - 1];
    if (!last) return;

    startLoadMore(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("space_comments")
        .select("*, profiles:user_id(username, display_name, avatar_url)")
        .eq("space_id", spaceId)
        .is("parent_id", null)
        .gt("created_at", last.created_at)
        .order("created_at", { ascending: true })
        .limit(PAGE_SIZE);

      if (!data?.length) {
        setHasMore(false);
        return;
      }

      let likedIds = new Set<string>();
      if (userId) {
        const { data: likes } = await supabase
          .from("comment_likes")
          .select("comment_id")
          .eq("user_id", userId)
          .in("comment_id", data.map((c) => c.id));
        likedIds = new Set(likes?.map((l) => l.comment_id));
      }

      const next = data.map((c) => ({
        ...c,
        profiles: c.profiles as CommentWithLike["profiles"],
        liked: likedIds.has(c.id),
      }));

      setComments((prev) => [...prev, ...next]);
      setHasMore(data.length === PAGE_SIZE);
    });
  };

  const handlePostComment = async (content: string) => {
    if (!userId || !currentProfile) return;
    const supabase = createClient();

    const { data, error } = await supabase
      .from("space_comments")
      .insert({ space_id: spaceId, user_id: userId, content, parent_id: null })
      .select("*, profiles:user_id(username, display_name, avatar_url)")
      .single();

    if (error || !data) return;

    const newComment: CommentWithLike = {
      ...data,
      profiles: data.profiles as CommentWithLike["profiles"],
      liked: false,
    };
    setComments((prev) => [...prev, newComment]);
    onCountChange(+1);

    const notificationPayload = {
      space_id: spaceId,
      space_title: spaceTitle,
      space_owner_username: spaceOwnerUsername,
      commenter_username: currentProfile.username,
      commenter_display_name: currentProfile.display_name,
      comment_preview: content.slice(0, 100),
    };

    // notify space owner (skip if commenter is the owner)
    const mentionedSet = new Set<string>();
    if (spaceOwnerId !== userId) {
      await createNotification(supabase, spaceOwnerId, "new_comment", notificationPayload);
    }

    // insert @mentions + notify mentioned users
    const mentioned = [...content.matchAll(/@(\w+)/g)].map((m) => m[1]);
    if (mentioned.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("username", mentioned);
      if (profiles?.length) {
        await supabase.from("comment_mentions").insert(
          profiles.map((p) => ({ comment_id: data.id, mentioned_user_id: p.id }))
        );
        const toNotify = profiles.filter(
          (p) => p.id !== userId && p.id !== spaceOwnerId && !mentionedSet.has(p.id)
        );
        for (const p of toNotify) {
          mentionedSet.add(p.id);
          await createNotification(supabase, p.id, "comment_mention", notificationPayload);
        }
      }
    }
  };

  const handleDeleteComment = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    onCountChange(-1);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable comments area */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-16 text-center px-6">
            <p className="text-sm font-medium">No comments yet</p>
            <p className="text-xs text-muted-foreground">Be the first to share your thoughts</p>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-5">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                userId={userId}
                currentProfile={currentProfile}
                spaceId={spaceId}
                spaceOwnerUsername={spaceOwnerUsername}
                spaceTitle={spaceTitle}
                onDelete={handleDeleteComment}
              />
            ))}

            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-2 text-xs text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load more comments"
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Input pinned at bottom */}
      <CommentInput
        userId={userId}
        currentProfile={currentProfile}
        onSubmit={handlePostComment}
      />
    </div>
  );
}
