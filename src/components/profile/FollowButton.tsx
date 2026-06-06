"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface FollowButtonProps {
  profileId: string;
  initialIsFollowing: boolean;
}

export function FollowButton({ profileId, initialIsFollowing }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { t } = useLanguage();

  const handleClick = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    try {
      if (wasFollowing) {
        const { error } = await supabase
          .from("user_follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profileId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_follows")
          .insert({ follower_id: user.id, following_id: profileId });
        if (error) throw error;
      }
      startTransition(() => router.refresh());
    } catch {
      setIsFollowing(wasFollowing);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
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
