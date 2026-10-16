"use client";

import { openExternal } from "@/lib/in-app-browser";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { HoverPrefetchLink } from "@/components/HoverPrefetchLink";
import { Card, CardContent } from "@/components/ui/card";
import { SpacePreview } from "./SpacePreview";
import { deleteSpace } from "../actions/delete-space";
import { duplicateSpace } from "../actions/duplicate-space";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ExternalLink, FolderPlus, Pencil, Trash2, Bookmark, Globe, Lock, Copy } from "lucide-react";
import { LikeButton } from "@/features/social";
import { ShareButton } from "./ShareButton";
import { StarButton, AddToCollectionDialog, removeSpaceFromCollection } from "@/features/collections";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Space } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { spaceDisplayTitle } from "@/lib/spaces/display-title";

/** Only http(s) links are safe to navigate to directly — rejects javascript:,
 * data:, vbscript:, etc. */
function isSafeHttpUrl(u: string): boolean {
  try {
    const { protocol } = new URL(u);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

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
  /** Eager-load this card's preview image (first above-the-fold card only). */
  priority?: boolean;
}

export function SpaceCard({ space, username, routeUsername, editable, liked, saved, compact, collectionId, isOwn, hashtags = [], priority = false }: SpaceCardProps) {
  const spaceUrl = routeUsername ? `/${routeUsername}/space/${space.id}` : `/space/${space.id}`;
  // Link- and video-type spaces jump straight to their external URL in a new
  // tab instead of opening the in-app space page — a link points off-site, so
  // there is nothing of ours to show. Video rows carry their URL in `url` (new
  // rows, stored as `content_type: "link"`) or `video_url` (legacy `"video"`
  // rows). Only http(s) is allowed — anything else (e.g. a javascript: URL from
  // a non-builder insert path) falls back to the in-app page so a malicious
  // scheme can't execute on click.
  const externalUrl = space.url ?? space.video_url ?? null;
  const isExternalLink =
    (space.content_type === "link" || space.content_type === "video") &&
    !!externalUrl &&
    isSafeHttpUrl(externalUrl);
  const clickHref = isExternalLink ? externalUrl! : spaceUrl;
  const externalLinkProps = isExternalLink
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};
  const router = useRouter();
  const { t } = useLanguage();
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(saved ?? false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleRemoveFromCollection = async () => {
    if (!collectionId) return;
    if (!confirm(t.space.confirmRemoveFromCollection)) return;
    await removeSpaceFromCollection({ collectionId, spaceId: space.id });
    router.refresh();
  };

  const handleDelete = async () => {
    await deleteSpace({ id: space.id });
    router.refresh();
  };

  const handleDuplicate = async () => {
    if (isDuplicating) return;
    setIsDuplicating(true);
    try {
      const res = await duplicateSpace({ id: space.id });
      if (!res.ok) {
        alert(res.error === "SPACE_LIMIT_REACHED" ? t.plan.spaceLimitReached : (res.error || t.space.duplicateFailed));
        return;
      }
      router.push(`/dashboard/contents/edit-space/${res.spaceId}`);
    } finally {
      setIsDuplicating(false);
    }
  };

  const cardContent = compact ? (
    <Card className="@container group overflow-hidden rounded-xl p-0 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-white/10 border-foreground/10 hover:border-violet-500/40 dark:hover:border-violet-500/25">
      <HoverPrefetchLink href={clickHref} {...externalLinkProps} className="block">
        <div className="aspect-square bg-muted relative overflow-hidden">
          <SpacePreview space={space} priority={priority} />
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
          {/* Title + subtitle — always-on gradient overlay, no separate footer */}
          {(space.title.trim() || space.description) && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2.5 pt-10 pb-2">
              {space.title.trim() && (
                <p className="text-[11px] @[140px]:text-[13px] font-semibold text-white truncate">
                  {space.title}
                </p>
              )}
              {space.description && (
                <p className="mt-0.5 text-[9px] @[140px]:text-[11px] leading-tight text-white/75 line-clamp-2">
                  {space.description}
                </p>
              )}
            </div>
          )}
        </div>
      </HoverPrefetchLink>
    </Card>
  ) : (
    <Card className="@container group overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/5 hover:-translate-y-1 border-foreground/10 hover:border-violet-500/35 dark:hover:border-violet-500/20 p-0">
      <HoverPrefetchLink href={clickHref} {...externalLinkProps} className="block">
        <div className="aspect-video bg-muted relative overflow-hidden">
          <SpacePreview space={space} priority={priority} />
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
            {spaceDisplayTitle(space)}
          </h3>
          <p className="mt-1 text-[10px] @[280px]:text-xs @[380px]:text-sm text-muted-foreground line-clamp-2 h-10 leading-5">
            {space.title.trim() ? space.description ?? "" : ""}
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
                  <StarButton spaceId={space.id} spaceTitle={spaceDisplayTitle(space)} initialSaved={isSaved} size="sm" onToggle={setIsSaved} />
                </>
              )}
              <ShareButton url={spaceUrl} title={spaceDisplayTitle(space)} size="sm" />
            </div>
          </div>
        </CardContent>
      </HoverPrefetchLink>
    </Card>
  );

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>{cardContent}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={() =>
              isExternalLink
                ? openExternal(externalUrl!)
                : router.push(spaceUrl)
            }
          >
            <ExternalLink className="size-4" />
            {t.space.open}
          </ContextMenuItem>
          {!editable && !isOwn && (
            <>
              <ContextMenuItem onClick={() => setCollectionDialogOpen(true)}>
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
                    onClick={() => router.push(`/dashboard/contents/edit-space/${space.id}`)}
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
        spaceTitle={spaceDisplayTitle(space)}
        onSavedChange={setIsSaved}
        onUnauthenticated={() => router.push("/login")}
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
