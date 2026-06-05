"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface MentionPopoverProps {
  query: string;
  onSelect: (username: string) => void;
  className?: string;
}

type MentionUser = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export function MentionPopover({ query, onSelect, className }: MentionPopoverProps) {
  const [results, setResults] = useState<MentionUser[]>([]);

  useEffect(() => {
    if (query.length > 20) return;
    const supabase = createClient();
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .ilike("username", `${query}%`)
        .limit(5);
      setResults(data ?? []);
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  if (!results.length) return null;

  return (
    <div
      className={cn(
        "absolute bottom-full left-0 mb-1 w-56 bg-background border border-border rounded-lg shadow-lg overflow-hidden z-50",
        className
      )}
    >
      {results.map((user) => (
        <button
          key={user.username}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); // keep textarea focused
            onSelect(user.username);
          }}
          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-accent text-sm transition-colors text-left"
        >
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarImage src={user.avatar_url || undefined} />
            <AvatarFallback className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
              {(user.display_name || user.username)[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium truncate text-foreground">@{user.username}</p>
            {user.display_name && (
              <p className="text-xs text-muted-foreground truncate">{user.display_name}</p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
