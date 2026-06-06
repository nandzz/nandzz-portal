"use client";

import { useState } from "react";
import Link from "next/link";
import { SpaceCard } from "./SpaceCard";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, LayoutGrid, Grid3X3 } from "lucide-react";
import type { SpaceWithProfile, Space } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface SpaceGridProps {
  spaces: SpaceWithProfile[] | Space[];
  showAuthor?: boolean;
  showCreateCard?: boolean;
  editable?: boolean;
  likedSpaceIds?: string[];
  savedSpaceIds?: string[];
  collectionId?: string;
  currentUserId?: string;
  ownerUsername?: string;
}

export function SpaceGrid({
  spaces,
  showAuthor = false,
  showCreateCard = false,
  editable = false,
  likedSpaceIds = [],
  savedSpaceIds = [],
  collectionId,
  currentUserId,
  ownerUsername,
}: SpaceGridProps) {
  const { t } = useLanguage();
  const [compact, setCompact] = useState(false);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setCompact((v) => !v)}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={compact ? t.spaceGrid.comfortableView : t.spaceGrid.compactView}
        >
          {compact ? (
            <>
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">{t.spaceGrid.comfortable}</span>
            </>
          ) : (
            <>
              <Grid3X3 className="h-4 w-4" />
              <span className="hidden sm:inline">{t.spaceGrid.compact}</span>
            </>
          )}
        </button>

      </div>

      {/* Grid */}
      <div
        className={
          compact
            ? "grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6"
            : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {spaces.map((space) => {
          const profileUsername = "profiles" in space
            ? (space as SpaceWithProfile).profiles?.username
            : undefined;
          const displayUsername = showAuthor
            ? (
                "profiles" in space
                  ? (space as SpaceWithProfile).profiles?.display_name || profileUsername
                  : undefined
              )
            : undefined;
          const routeUsername = profileUsername || ownerUsername;
          return (
            <SpaceCard
              key={space.id}
              space={space}
              username={displayUsername || undefined}
              routeUsername={routeUsername || undefined}
              editable={editable}
              liked={likedSpaceIds.includes(space.id)}
              saved={savedSpaceIds.includes(space.id)}
              compact={compact}
              collectionId={collectionId}
              isOwn={!!currentUserId && space.user_id === currentUserId}
              hashtags={space.hashtags ?? []}
            />
          );
        })}
        {showCreateCard && (
          <Link href={collectionId ? `/dashboard/create-space?collectionId=${collectionId}` : "/dashboard/create-space"}>
            <Card
              className={
                compact
                  ? "group flex aspect-square items-center justify-center border-dashed border-border/60 transition-all duration-300 hover:shadow-md hover:border-violet-400 dark:hover:border-violet-500/50"
                  : "group flex aspect-auto min-h-[280px] items-center justify-center border-dashed border-border/60 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-violet-400 dark:hover:border-violet-500/50"
              }
            >
              {compact ? (
                <div className="flex flex-col items-center gap-1 p-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100/80 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800 group-hover:bg-violet-200/80 dark:group-hover:bg-violet-800/50 transition-colors">
                    <Plus className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <span className="text-[10px] font-medium leading-tight text-center text-muted-foreground">
                    {t.spaceGrid.addNew}
                  </span>
                </div>
              ) : (
                <CardContent className="flex flex-col items-center gap-3 p-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100/80 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800 group-hover:bg-violet-200/80 dark:group-hover:bg-violet-800/50 transition-colors">
                    <Plus className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <span className="font-medium">{t.spaceGrid.createNew}</span>
                  <span className="text-sm text-muted-foreground text-center">
                    {t.spaceGrid.createNewDesc}
                  </span>
                </CardContent>
              )}
            </Card>
          </Link>
        )}
        {spaces.length === 0 && !showCreateCard && (
          <p className="col-span-full py-12 text-center text-muted-foreground text-sm">
            {t.spaceGrid.noFilter}
          </p>
        )}
      </div>
    </div>
  );
}
