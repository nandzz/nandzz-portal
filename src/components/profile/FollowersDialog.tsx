"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type UserRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

interface FollowersDialogProps {
  profileId: string;
  type: "followers" | "following";
  count: number;
  children: React.ReactNode;
}

const PAGE_SIZE = 20;

export function FollowersDialog({ profileId, type, count, children }: FollowersDialogProps) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchPage = useCallback(async (from: number, append: boolean) => {
    const supabase = createClient();
    const to = from + PAGE_SIZE - 1;

    const query =
      type === "followers"
        ? supabase
            .from("user_follows")
            .select("profiles!user_follows_follower_id_fkey(id, username, display_name, avatar_url)")
            .eq("following_id", profileId)
            .range(from, to)
        : supabase
            .from("user_follows")
            .select("profiles!user_follows_following_id_fkey(id, username, display_name, avatar_url)")
            .eq("follower_id", profileId)
            .range(from, to);

    const { data } = await query;
    const rows = (data ?? []).map((row: any) => row.profiles).filter(Boolean) as UserRow[];

    setUsers((prev) => append ? [...prev, ...rows] : rows);
    setHasMore(rows.length === PAGE_SIZE);
    setOffset(from + rows.length);
  }, [profileId, type]);

  useEffect(() => {
    if (!open) return;
    setUsers([]);
    setOffset(0);
    setHasMore(false);
    setLoading(true);
    fetchPage(0, false).finally(() => setLoading(false));
  }, [open, fetchPage]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchPage(offset, true);
    setLoadingMore(false);
  };

  return (
    <>
      <button
        onClick={() => count > 0 && setOpen(true)}
        className={count > 0 ? "cursor-pointer hover:opacity-70 transition-opacity" : "cursor-default"}
      >
        {children}
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title={type.charAt(0).toUpperCase() + type.slice(1)}>
        {loading ? (
          <div className="flex justify-center py-8 text-sm text-muted-foreground">Loading…</div>
        ) : users.length === 0 ? (
          <div className="flex justify-center py-8 text-sm text-muted-foreground">No {type} yet.</div>
        ) : (
          <div className="flex flex-col gap-0">
            <ul className="max-h-80 overflow-y-auto divide-y divide-border -mx-2">
              {users.map((u) => (
                <li key={u.id}>
                  <Link
                    href={`/${u.username}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-2 py-3 hover:bg-muted/50 rounded-md transition-colors"
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={u.avatar_url || undefined} />
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
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
