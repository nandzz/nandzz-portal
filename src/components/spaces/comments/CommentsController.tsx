"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommentsPanel } from "./CommentsPanel";
import type { CommentWithLike } from "@/lib/types";

interface CommentsControllerProps {
  spaceId: string;
  spaceOwnerId: string;
  spaceOwnerUsername: string;
  spaceTitle: string;
  commentsCount: number;
  userId: string | null;
  currentProfile: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  initialComments: CommentWithLike[];
  initialHasMore: boolean;
  initialOpen?: boolean;
}

export function CommentsController({
  spaceId,
  spaceOwnerId,
  spaceOwnerUsername,
  spaceTitle,
  commentsCount,
  userId,
  currentProfile,
  initialComments,
  initialHasMore,
  initialOpen = false,
}: CommentsControllerProps) {
  const [open, setOpen] = useState(initialOpen);
  const [count, setCount] = useState(commentsCount);

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
        {count > 0 && <span>{count}</span>}
      </button>

      <CommentsPanel
        open={open}
        onClose={() => setOpen(false)}
        spaceId={spaceId}
        spaceOwnerId={spaceOwnerId}
        spaceOwnerUsername={spaceOwnerUsername}
        spaceTitle={spaceTitle}
        userId={userId}
        currentProfile={currentProfile}
        initialComments={initialComments}
        initialHasMore={initialHasMore}
        onCountChange={(delta) => setCount((c) => Math.max(0, c + delta))}
      />
    </>
  );
}
