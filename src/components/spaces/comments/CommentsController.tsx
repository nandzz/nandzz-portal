"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommentsPanel } from "./CommentsPanel";
import type { CommentWithLike } from "@/lib/types";

interface CommentsControllerProps {
  spaceId: string;
  commentsCount: number;
  userId: string | null;
  currentProfile: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  initialComments: CommentWithLike[];
  initialHasMore: boolean;
}

export function CommentsController({
  spaceId,
  commentsCount,
  userId,
  currentProfile,
  initialComments,
  initialHasMore,
}: CommentsControllerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md transition-colors hover:text-foreground text-sm",
          open ? "text-foreground" : "text-muted-foreground"
        )}
        aria-label="Toggle comments"
        aria-expanded={open}
      >
        <MessageCircle className={cn("size-5", open && "fill-current opacity-20")} />
        {commentsCount > 0 && <span>{commentsCount}</span>}
      </button>

      <CommentsPanel
        open={open}
        onClose={() => setOpen(false)}
        spaceId={spaceId}
        userId={userId}
        currentProfile={currentProfile}
        initialComments={initialComments}
        initialHasMore={initialHasMore}
      />
    </>
  );
}
