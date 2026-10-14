"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { toggleFollow } from "../actions/toggle-follow";

interface FollowButtonProps {
  profileId: string;
  initialIsFollowing: boolean;
}

export function FollowButton({ profileId, initialIsFollowing }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, setIsPending] = useState(false);
  const inFlight = useRef(false);
  const router = useRouter();
  const { t } = useLanguage();

  const handleClick = async () => {
    // One request at a time: a double-tap used to send two toggles and land
    // back on the original state.
    if (inFlight.current) return;
    inFlight.current = true;
    setIsPending(true);

    // Optimistic update; the server gets the desired end state (idempotent).
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    try {
      // The action revalidates both profiles and returns the fresh render.
      const result = await toggleFollow({ profileId, follow: !wasFollowing });
      if (!result.ok) {
        setIsFollowing(wasFollowing);
        if (result.error === "UNAUTHENTICATED") router.push("/login");
        return;
      }
      setIsFollowing(result.isFollowing);
    } catch {
      setIsFollowing(wasFollowing);
    } finally {
      inFlight.current = false;
      setIsPending(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={isFollowing}
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      className={cn(
        "gap-1.5 transition-all",
        isFollowing && "border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-red-500 hover:border-red-200 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-red-950/20 dark:hover:text-red-400 dark:hover:border-red-800"
      )}
    >
      {isFollowing ? (
        <UserCheck className="h-3.5 w-3.5" />
      ) : (
        <UserPlus className="h-3.5 w-3.5" />
      )}
      {isFollowing ? t.profile.followingBtn : t.profile.follow}
    </Button>
  );
}
