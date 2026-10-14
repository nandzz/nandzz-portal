"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SpaceCard } from "./SpaceCard";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, LayoutGrid, Grid3X3, EyeOff, SlidersHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setSectionVisibility } from "@/features/profile";
import type { SpaceWithProfile, Space } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  SECTION_ORDER,
  resolveContentType,
  sectionForType,
  getSectionLabel,
  getSectionDescription,
  type SectionId,
} from "@/lib/spaces/content-types";

/** Owner-only settings that back the profile-visibility gear. */
interface SectionSettings {
  profileId: string;
  username: string;
  visibility: Record<SectionId, boolean>;
}

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
  /** When provided (owner's own dashboard), renders the profile-visibility gear. */
  sectionSettings?: SectionSettings;
}

type Tab = "all" | SectionId;

// One grid row per column count, so a section preview never sprawls vertically.
const PAGE_COMFORTABLE = 9; // 3 cols × 3 rows
const PAGE_COMPACT = 18; // 6 cols × 3 rows

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
  sectionSettings,
}: SpaceGridProps) {
  const { t } = useLanguage();
  const [compact, setCompact] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  // Per-section "load more" ceiling, only consumed in single-section view.
  const [limits, setLimits] = useState<Record<SectionId, number>>({
    informative: PAGE_COMFORTABLE,
    gallery: PAGE_COMFORTABLE,
    links: PAGE_COMFORTABLE,
  });
  const [visibility, setVisibility] = useState<Record<SectionId, boolean> | null>(
    sectionSettings?.visibility ?? null
  );

  const pageSize = compact ? PAGE_COMPACT : PAGE_COMFORTABLE;

  const gridClassName = compact
    ? "grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6"
    : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3";

  // Stable partition of spaces into their display sections, preserving the
  // incoming (already created_at desc) order within each group.
  const grouped = useMemo(() => {
    const g: Record<SectionId, (SpaceWithProfile | Space)[]> = {
      informative: [],
      gallery: [],
      links: [],
    };
    for (const space of spaces) {
      g[sectionForType(resolveContentType(space as Space))].push(space);
    }
    return g;
  }, [spaces]);

  const nonEmptySections = SECTION_ORDER.filter((id) => grouped[id].length > 0);
  const showTabs = nonEmptySections.length > 1;
  // Keep the active tab valid if content changes underneath it.
  const effectiveTab: Tab =
    activeTab !== "all" && grouped[activeTab].length === 0 ? "all" : activeTab;
  const sectionsToRender: SectionId[] =
    effectiveTab === "all" ? nonEmptySections : [effectiveTab];

  const renderCard = (space: SpaceWithProfile | Space, priority = false) => {
    const profileUsername =
      "profiles" in space ? (space as SpaceWithProfile).profiles?.username : undefined;
    const displayUsername = showAuthor
      ? "profiles" in space
        ? (space as SpaceWithProfile).profiles?.display_name || profileUsername
        : undefined
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
        priority={priority}
      />
    );
  };

  const createTile = (
    <Link
      key="create-tile"
      href={
        collectionId
          ? `/dashboard/contents/create-space?collectionId=${collectionId}`
          : "/dashboard/contents/create-space"
      }
    >
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
  );

  const toggleVisibility = async (section: SectionId, next: boolean) => {
    if (!sectionSettings || !visibility) return;
    setVisibility((v) => (v ? { ...v, [section]: next } : v)); // optimistic
    try {
      // The action revalidates the public profile itself.
      const result = await setSectionVisibility({ section, value: next });
      if (!result.ok) throw new Error(result.error);
    } catch {
      // Revert only this section — a stale whole-object snapshot would also
      // undo other toggles made while this request was in flight.
      setVisibility((v) => (v ? { ...v, [section]: !next } : v));
    }
  };

  const tabButton = (tab: Tab, label: string) => {
    const active = effectiveTab === tab;
    return (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        className={
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
          (active
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground")
        }
        aria-pressed={active}
      >
        {label}
        {tab !== "all" && (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground tabular-nums">
            {grouped[tab].length}
          </span>
        )}
      </button>
    );
  };

  const hasAnyContent = nonEmptySections.length > 0;

  return (
    <div className="space-y-6">
      {/* Toolbar: filter tabs (left) + visibility gear & density toggle (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showTabs ? (
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
            {tabButton("all", t.spaceGrid.all)}
            {nonEmptySections.map((id) => tabButton(id, getSectionLabel(t, id)))}
          </div>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-1">
          {sectionSettings && visibility && (
            <DropdownMenu>
              <DropdownMenuTrigger
                title={t.spaceGrid.profileVisibility}
                aria-label={t.spaceGrid.profileVisibility}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">{t.spaceGrid.profileVisibility}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
                    {t.spaceGrid.visibilityHint}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {SECTION_ORDER.map((id) => (
                    <DropdownMenuCheckboxItem
                      key={id}
                      checked={visibility[id]}
                      onCheckedChange={(checked) => toggleVisibility(id, checked === true)}
                      closeOnClick={false}
                    >
                      {getSectionLabel(t, id)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

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
      </div>

      {hasAnyContent ? (
        <div className="space-y-10">
          {sectionsToRender.map((id, index) => {
            const items = grouped[id];
            const singleSection = effectiveTab !== "all";
            // "All" view: preview one row-set per section, link to the full tab.
            // Single-section view: honor the per-section "load more" ceiling.
            const limit = singleSection ? limits[id] : pageSize;
            const shown = items.slice(0, limit);
            const hasMore = items.length > shown.length;
            const hiddenOnProfile = visibility ? visibility[id] === false : false;

            return (
              <section key={id}>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                      {getSectionLabel(t, id)}{" "}
                      <span className="font-normal text-muted-foreground tabular-nums">
                        {items.length}
                      </span>
                      {hiddenOnProfile && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <EyeOff className="h-3 w-3" />
                          {t.spaceGrid.hiddenOnProfile}
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {getSectionDescription(t, id)}
                    </p>
                  </div>
                </div>
                <div className={gridClassName}>
                  {shown.map((space, i) => renderCard(space, index === 0 && i === 0))}
                  {showCreateCard && effectiveTab === "all" && index === 0 && createTile}
                </div>
                {singleSection && hasMore && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() =>
                        setLimits((prev) => ({ ...prev, [id]: prev[id] + pageSize }))
                      }
                      className="rounded-lg border border-border/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {t.spaceGrid.loadMore}
                      <span className="ml-1.5 tabular-nums">
                        {shown.length} / {items.length}
                      </span>
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : showCreateCard ? (
        <div className={gridClassName}>{createTile}</div>
      ) : (
        <p className="py-12 text-center text-muted-foreground text-sm">
          {t.spaceGrid.noFilter}
        </p>
      )}
    </div>
  );
}
