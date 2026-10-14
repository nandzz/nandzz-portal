"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { loadFollowList } from "../actions/load-follow-list";
import type { FollowUser } from "../data/profiles";

interface FollowListProps {
  profileId: string;
  type: "followers" | "following";
  // The dialog wants a capped, inner-scrolling box; the standalone dashboard
  // page lets the list flow in the page.
  scrollable?: boolean;
  // Fired when a row is tapped — lets the dialog close itself on navigation.
  onNavigate?: () => void;
}

// Shared followers/following list + pagination. Lives here (not in the dialog)
// so the /dashboard/followers and /dashboard/following pages and the profile
// dialog all run the exact same query.
export function FollowList({ profileId, type, scrollable = false, onNavigate }: FollowListProps) {
  const { t } = useLanguage();
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [failed, setFailed] = useState(false);

  const fetchPage = useCallback(async (from: number, append: boolean) => {
    try {
      const result = await loadFollowList({ profileId, type, offset: from });
      if (!result.ok) throw new Error(result.error);
      setFailed(false);
      setUsers((prev) => {
        if (!append) return result.users;
        // A follow/unfollow between pages shifts offsets: never show a dupe.
        const seen = new Set(prev.map((u) => u.id));
        return [...prev, ...result.users.filter((u) => !seen.has(u.id))];
      });
      setHasMore(result.hasMore);
      setOffset(result.nextOffset);
    } catch (err) {
      console.error("[follow-list] load failed:", err);
      setFailed(true);
    }
  }, [profileId, type]);

  useEffect(() => {
    // Reset pagination and reload when the target profile/type changes. This
    // deliberately drives state from an effect (unchanged from the pre-migration
    // implementation).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsers([]);
    setOffset(0);
    setHasMore(false);
    setLoading(true);
    setFailed(false);
    fetchPage(0, false).finally(() => setLoading(false));
  }, [fetchPage]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await fetchPage(offset, true);
    } finally {
      setLoadingMore(false);
    }
  };

  const retry = () => {
    setLoading(true);
    fetchPage(0, false).finally(() => setLoading(false));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8 text-sm text-muted-foreground">{t.profile.loadingUsers}</div>
    );
  }

  if (failed && users.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
        <p>{t.common.error}</p>
        <Button variant="outline" size="sm" onClick={retry}>{t.common.retry}</Button>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex justify-center py-8 text-sm text-muted-foreground">
        {type === "followers" ? t.profile.noFollowers : t.profile.noFollowing}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      <ul
        className={cn(
          "divide-y divide-border -mx-2",
          scrollable && "scrollbar-hide max-h-80 overflow-y-auto overscroll-contain"
        )}
      >
        {users.map((u) => (
          <li key={u.id}>
            <Link
              href={`/${u.username}`}
              onClick={onNavigate}
              className="flex items-center gap-3 px-2 py-3 hover:bg-muted/50 rounded-md transition-colors"
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={u.avatar_url || undefined} alt="" />
                <AvatarFallback className="text-sm bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                  {(u.display_name || u.username)[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{u.display_name || u.username}</p>
                <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="pt-3 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full border-border/60 text-muted-foreground"
          >
            {loadingMore ? t.profile.loadingUsers : t.profile.loadMore}
          </Button>
        </div>
      )}
    </div>
  );
}
