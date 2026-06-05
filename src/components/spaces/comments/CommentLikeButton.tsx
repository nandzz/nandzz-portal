"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface CommentLikeButtonProps {
  commentId: string;
  initialLikesCount: number;
  initialLiked: boolean;
  userId: string | null;
}

export function CommentLikeButton({
  commentId,
  initialLikesCount,
  initialLiked,
  userId,
}: CommentLikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialLikesCount);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userId) return;

    const wasLiked = liked;
    const prevCount = count;
    setLiked(!wasLiked);
    setCount(wasLiked ? prevCount - 1 : prevCount + 1);

    const supabase = createClient();
    try {
      if (wasLiked) {
        const { error } = await supabase
          .from("comment_likes")
          .delete()
          .eq("user_id", userId)
          .eq("comment_id", commentId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("comment_likes")
          .insert({ user_id: userId, comment_id: commentId });
        if (error) throw error;
      }
    } catch {
      setLiked(wasLiked);
      setCount(prevCount);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1 text-xs transition-colors hover:text-red-500",
        liked ? "text-red-500" : "text-muted-foreground"
      )}
      aria-label={liked ? "Unlike comment" : "Like comment"}
    >
      <Heart className={cn("size-3.5", liked && "fill-red-500")} />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
