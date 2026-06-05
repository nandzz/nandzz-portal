"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, CornerDownRight, ChevronDown, ChevronUp } from "lucide-react";
import { CommentLikeButton } from "./CommentLikeButton";
import { CommentInput } from "./CommentInput";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import type { CommentWithLike } from "@/lib/types";

interface CommentItemProps {
  comment: CommentWithLike;
  userId: string | null;
  currentProfile: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  spaceId: string;
  onDelete: (commentId: string) => void;
  isReply?: boolean;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 4) return `${w}w`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderContent(content: string) {
  return content.split(/(@\w+)/g).map((part, i) => {
    if (part.startsWith("@") && part.length > 1) {
      const username = part.slice(1);
      return (
        <Link
          key={i}
          href={`/${username}`}
          className="text-violet-600 dark:text-violet-400 hover:underline font-medium"
        >
          {part}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function CommentItem({
  comment,
  userId,
  currentProfile,
  spaceId,
  onDelete,
  isReply = false,
}: CommentItemProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replies, setReplies] = useState<CommentWithLike[]>([]);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [replyCount, setReplyCount] = useState(0);
  const [repliesLoaded, setRepliesLoaded] = useState(false);

  const isOwnComment = userId === comment.user_id;
  const displayName =
    comment.profiles.display_name || comment.profiles.username || "User";
  const initials = displayName[0]?.toUpperCase() ?? "U";

  const loadReplies = async () => {
    if (repliesLoaded) {
      setRepliesOpen((o) => !o);
      return;
    }
    setRepliesLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("space_comments")
      .select("*, profiles:user_id(username, display_name, avatar_url)")
      .eq("parent_id", comment.id)
      .order("created_at", { ascending: true });

    let likedIds = new Set<string>();
    if (userId && data?.length) {
      const { data: likes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", userId)
        .in("comment_id", data.map((r) => r.id));
      likedIds = new Set(likes?.map((l) => l.comment_id));
    }

    const withLike = (data ?? []).map((r) => ({
      ...r,
      profiles: r.profiles as CommentWithLike["profiles"],
      liked: likedIds.has(r.id),
    }));
    setReplies(withLike);
    setRepliesLoaded(true);
    setRepliesOpen(true);
    setRepliesLoading(false);
  };

  const handleDelete = async () => {
    const supabase = createClient();
    const { error } = await supabase
      .from("space_comments")
      .delete()
      .eq("id", comment.id);
    if (!error) onDelete(comment.id);
  };

  const handleReplySubmit = async (content: string) => {
    if (!userId || !currentProfile) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("space_comments")
      .insert({
        space_id: spaceId,
        user_id: userId,
        parent_id: comment.id,
        content,
      })
      .select("*, profiles:user_id(username, display_name, avatar_url)")
      .single();

    if (error || !data) return;

    const newReply: CommentWithLike = {
      ...data,
      profiles: data.profiles as CommentWithLike["profiles"],
      liked: false,
    };
    setReplies((prev) => [...prev, newReply]);
    setReplyCount((c) => c + 1);
    setRepliesLoaded(true);
    setRepliesOpen(true);
    setShowReplyInput(false);

    // insert mentions
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
      }
    }
  };

  const handleDeleteReply = (replyId: string) => {
    setReplies((prev) => prev.filter((r) => r.id !== replyId));
    setReplyCount((c) => Math.max(0, c - 1));
  };

  return (
    <div className={isReply ? "ml-9" : ""}>
      <div className="flex gap-2.5 group/comment">
        <Link href={`/${comment.profiles.username}`} className="shrink-0 mt-0.5">
          <Avatar className="h-7 w-7">
            <AvatarImage src={comment.profiles.avatar_url || undefined} />
            <AvatarFallback className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <Link
              href={`/${comment.profiles.username}`}
              className="text-sm font-semibold hover:underline truncate"
            >
              {displayName}
            </Link>
            <span className="text-xs text-muted-foreground shrink-0">
              {relativeTime(comment.created_at)}
            </span>
          </div>
          <p className="text-sm mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
            {renderContent(comment.content)}
          </p>

          <div className="flex items-center gap-3 mt-1.5">
            <CommentLikeButton
              commentId={comment.id}
              initialLikesCount={comment.likes_count}
              initialLiked={comment.liked}
              userId={userId}
            />
            {!isReply && userId && (
              <button
                type="button"
                onClick={() => setShowReplyInput((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CornerDownRight className="size-3.5" />
                Reply
              </button>
            )}
            {isOwnComment && (
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover/comment:opacity-100"
                aria-label="Delete comment"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>

          {/* Reply count toggle */}
          {!isReply && (replyCount > 0 || replies.length > 0) && (
            <button
              type="button"
              onClick={loadReplies}
              disabled={repliesLoading}
              className="mt-2 inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline"
            >
              {repliesOpen ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
              {repliesLoading
                ? "Loading…"
                : repliesOpen
                ? "Hide replies"
                : `${replyCount || replies.length} ${(replyCount || replies.length) === 1 ? "reply" : "replies"}`}
            </button>
          )}
        </div>
      </div>

      {/* Reply input */}
      {showReplyInput && (
        <div className="ml-9 mt-2">
          <CommentInput
            userId={userId}
            currentProfile={currentProfile}
            onSubmit={handleReplySubmit}
            placeholder={`Reply to ${displayName}…`}
            autoFocus
            onCancel={() => setShowReplyInput(false)}
          />
        </div>
      )}

      {/* Replies */}
      {repliesOpen && replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              userId={userId}
              currentProfile={currentProfile}
              spaceId={spaceId}
              onDelete={handleDeleteReply}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}
