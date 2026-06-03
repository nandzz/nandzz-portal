"use client";

import { Eye, Bot } from "lucide-react";
import type { Profile } from "@/lib/types";
import { AgentChat } from "./AgentChat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AgentPublicProps {
  profile: Profile;
  isPreview?: boolean;
  hasDocuments?: boolean;
}

export function AgentPublic({ profile, isPreview, hasDocuments = true }: AgentPublicProps) {
  const displayName = profile.display_name || profile.username;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {isPreview && (
        <div className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-violet-50 dark:bg-violet-950/30 border-b border-violet-200 dark:border-violet-800 text-xs text-violet-700 dark:text-violet-300 font-medium">
          <Eye className="w-3.5 h-3.5" />
          Preview mode — this is how visitors see your agent
        </div>
      )}

      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto overflow-hidden">
        {/* Profile header */}
        <div className="flex-shrink-0 flex flex-col items-center text-center pt-8 pb-6 px-6">
          <Avatar className="w-16 h-16 border-2 border-background shadow-lg ring-2 ring-violet-200/50 dark:ring-violet-800/30">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-xl bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
              {displayName[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h1 className="mt-3 text-lg font-bold tracking-tight">{displayName}</h1>
          <p className="text-xs text-muted-foreground">@{profile.username}</p>
          {profile.tagline && (
            <p className="mt-1.5 text-xs font-medium text-violet-600 dark:text-violet-400">
              {profile.tagline}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {hasDocuments
              ? `Ask anything — powered by ${displayName}'s public knowledge`
              : `${displayName}'s agent`}
          </p>
        </div>

        {/* Chat or not-ready state */}
        <div className="flex-1 border border-border rounded-t-2xl overflow-hidden bg-background/60 backdrop-blur-sm shadow-sm mx-4">
          {hasDocuments ? (
            <AgentChat username={profile.username} displayName={displayName} preview={isPreview} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-muted">
                <Bot className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-medium">{displayName}&apos;s agent isn&apos;t ready yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  They haven&apos;t published any knowledge for their agent yet.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
