"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { SpacePreview } from "./SpacePreview";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ExternalLink, FolderPlus, Pencil, Trash2, Bookmark, Globe, Lock, Copy } from "lucide-react";
import { LikeButton } from "./LikeButton";
import { ShareButton } from "./ShareButton";
import { StarButton } from "./StarButton";
import { AddToCollectionDialog } from "@/components/collections/AddToCollectionDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Space } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface SpaceCardProps {
  space: Space;
  username?: string;
  routeUsername?: string;
  editable?: boolean;
  liked?: boolean;
  saved?: boolean;
  compact?: boolean;
  collectionId?: string;
  isOwn?: boolean;
  hashtags?: string[];
}

export function SpaceCard({ space, username, routeUsername, editable, liked, saved, compact, collectionId, isOwn, hashtags = [] }: SpaceCardProps) {
  const spaceUrl = routeUsername ? `/${routeUsername}/space/${space.id}` : `/space/${space.id}`;
  const router = useRouter();
  const { t } = useLanguage();
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(saved ?? false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleRemoveFromCollection = async () => {
    if (!collectionId) return;
    if (!confirm(t.space.confirmRemoveFromCollection)) return;
    const supabase = createClient();
    await supabase
      .from("collection_spaces")
      .delete()
      .eq("collection_id", collectionId)
      .eq("space_id", space.id);
    router.refresh();
  };

  const handleOpenSaveDialog = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setCollectionDialogOpen(true);
  };

  const handleDelete = async () => {
    const supabase = createClient();
    await supabase.from("spaces").delete().eq("id", space.id);
    router.refresh();
  };

  const handleDuplicate = async () => {
    if (isDuplicating) return;
    setIsDuplicating(true);
    try {
      const res = await fetch(`/api/spaces/${space.id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error === "INSUFFICIENT_CREDITS" ? t.space.duplicateNoCredits : (data?.error || t.space.duplicateFailed));
        return;
      }
      router.push(`/dashboard/edit-space/${data.spaceId}`);
    } finally {
      setIsDuplicating(false);
    }
  };

  const cardContent = compact ? (
    <Card className="@container group overflow-hidden transition-all duration-200 hover:shadow-md hover:shadow-violet-500/10 border-border/60 dark:border-border/80 dark:hover:border-violet-500/20 p-0">
      <Link href={spaceUrl} className="block">
        <div className="aspect-square bg-muted relative overflow-hidden">
          <SpacePreview space={space} />
          {/* Hover gradient overlay with title */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-1.5">
            <span className="text-[8px] @[120px]:text-[10px] font-medium text-white leading-tight line-clamp-2">
              {space.title}
            </span>
          </div>
          {/* Visibility badge — owner only */}
          {editable && (
            <div className="absolute top-1.5 right-1.5 z-10">
              {space.is_public ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-black/55 backdrop-blur-sm px-1.5 py-0.5 text-[7px] @[120px]:text-[9px] font-medium text-white">
                  <Globe className="h-2 w-2" />
                  {t.space.public}
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-black/55 backdrop-blur-sm px-1.5 py-0.5 text-[7px] @[120px]:text-[9px] font-medium text-white">
                  <Lock className="h-2 w-2" />
                  {t.space.private}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="px-2 pt-1.5 pb-2.5 h-[52px]">
          <p className="text-[8px] @[120px]:text-[10px] font-medium truncate text-foreground/80 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
            {space.title}
          </p>
          {space.description && (
            <p className="text-[7px] @[120px]:text-[9px] text-muted-foreground line-clamp-2 mt-0.5 leading-tight">
              {space.description}
            </p>
          )}
        </div>
      </Link>
    </Card>
  ) : (
    <Card className="@container group overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/5 hover:-translate-y-1 border-border/60 dark:border-border/80 dark:hover:border-violet-500/20 p-0">
      <Link href={spaceUrl} className="block">
        <div className="aspect-video bg-muted relative overflow-hidden">
          <SpacePreview space={space} />
          {/* Hover gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {/* Visibility badge — owner only */}
          {editable && (
            <div className="absolute top-2 right-2 z-10">
              {space.is_public ? (
                <span className="inline-flex items-center gap-0.5 @[280px]:gap-1 rounded-full bg-black/55 backdrop-blur-sm px-1.5 @[280px]:px-2 py-0.5 text-[8px] @[280px]:text-[10px] font-medium text-white">
                  <Globe className="h-2 w-2 @[280px]:h-2.5 @[280px]:w-2.5" />
                  {t.space.public}
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 @[280px]:gap-1 rounded-full bg-black/55 backdrop-blur-sm px-1.5 @[280px]:px-2 py-0.5 text-[8px] @[280px]:text-[10px] font-medium text-white">
                  <Lock className="h-2 w-2 @[280px]:h-2.5 @[280px]:w-2.5" />
                  {t.space.private}
                </span>
              )}
            </div>
          )}
        </div>
        <CardContent className="p-4 flex flex-col">
          <div className="flex items-center flex-wrap gap-1.5 h-[22px] overflow-hidden">
            {hashtags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/hashtag/${tag}`); }}
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[8px] @[300px]:text-[10px] font-medium text-muted-foreground hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
              >
                #{tag}
              </button>
            ))}
          </div>
          <h3 className="text-sm @[280px]:text-base @[380px]:text-lg font-bold truncate mt-2 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
            {space.title}
          </h3>
          <p className="mt-1 text-[10px] @[280px]:text-xs @[380px]:text-sm text-muted-foreground line-clamp-2 h-10 leading-5">
            {space.description ?? ""}
          </p>
          <div className="mt-3 flex items-center justify-between">
            {username ? (
              <p className="text-[10px] @[280px]:text-xs text-muted-foreground">by {username}</p>
            ) : (
              <span />
            )}
            <div
              className="flex items-center gap-1"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              {!editable && !isOwn && (
                <>
                  <LikeButton
                    spaceId={space.id}
                    initialLikesCount={space.likes_count ?? 0}
                    initialLiked={liked}
                    size="sm"
                  />
                  <StarButton spaceId={space.id} spaceTitle={space.title} initialSaved={isSaved} size="sm" onToggle={setIsSaved} />
                </>
              )}
              <ShareButton url={spaceUrl} title={space.title} size="sm" />
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  );

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>{cardContent}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => router.push(spaceUrl)}>
            <ExternalLink className="size-4" />
            {t.space.open}
          </ContextMenuItem>
          {!editable && !isOwn && (
            <>
              <ContextMenuItem onClick={handleOpenSaveDialog}>
                <Bookmark className={`size-4 ${isSaved ? "fill-violet-500 text-violet-500" : ""}`} />
                {isSaved ? t.space.manageCollections : t.space.saveToCollection}
              </ContextMenuItem>
              {space.is_public && (
                <ContextMenuItem onClick={handleDuplicate} disabled={isDuplicating}>
                  <Copy className="size-4" />
                  {isDuplicating ? t.space.duplicating : t.space.duplicate}
                </ContextMenuItem>
              )}
            </>
          )}
          {editable && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => setCollectionDialogOpen(true)}>
                <FolderPlus className="size-4" />
                {t.space.addToCollection}
              </ContextMenuItem>
              {collectionId && (
                <ContextMenuItem variant="destructive" onClick={handleRemoveFromCollection}>
                  <Trash2 className="size-4" />
                  {t.space.removeFromCollection}
                </ContextMenuItem>
              )}
              {isOwn && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={() => router.push(`/dashboard/edit-space/${space.id}`)}
                  >
                    <Pencil className="size-4" />
                    {t.space.edit}
                  </ContextMenuItem>
                  <ContextMenuItem variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
                    <Trash2 className="size-4" />
                    {t.space.deleteSpace}
                  </ContextMenuItem>
                </>
              )}
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <AddToCollectionDialog
        open={collectionDialogOpen}
        onClose={() => setCollectionDialogOpen(false)}
        spaceId={space.id}
        spaceTitle={space.title}
        onSavedChange={setIsSaved}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title={t.space.deleteSpace}
        description={t.space.confirmDelete}
        confirmLabel={t.space.deleteSpace}
        cancelLabel={t.space.cancel}
      />
    </>
  );
}
