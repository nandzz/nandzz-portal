"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/BackButton";
import { LikeButton } from "@/features/social";
import { StarButton } from "@/features/collections";
import { CommentsController } from "@/features/comments";
import { ReportLink } from "@/features/legal/components/ReportLink";
import { IdleChromeActivator } from "@/contexts/ChromeContext";
import { spaceDisplayTitle } from "@/lib/spaces/display-title";
import { loadSpaceView } from "../actions/load-space-view";
import type { SpaceView, ViewerProfile } from "../view-types";
import { ShareMenu } from "./ShareMenu";
import { DuplicateSpaceButton } from "./DuplicateSpaceButton";
import { SpaceOwnerMenu } from "./SpaceOwnerMenu";
import { HtmlSpaceEditor } from "./HtmlSpaceEditor";
import { PdfViewerWrapper } from "./PdfViewerWrapper";
import { IframeLoader } from "./IframeLoader";
import { VideoEmbed, detectVideo } from "./VideoEmbed";
import { MarkdownViewer } from "./MarkdownViewer";
import { MarkdownSpaceEditor } from "./MarkdownSpaceEditor";
import { ViewTracker } from "./ViewTracker";
import { SpaceSiblingNav } from "./SpaceSiblingNav";
import { ImageSwipeTrack } from "./ImageSwipeTrack";

interface SpaceViewerProps {
  initial: SpaceView;
  username: string;
  profile: ViewerProfile;
  /** Signed in → the mobile tab bar is shown, so the viewer clears it. */
  signedIn: boolean;
  commentsOpen: boolean;
}

/**
 * The immersive space viewer. Browsing to a sibling (arrows, ←/→, swipe on
 * images) swaps the space in place — the shell stays mounted, the URL is
 * updated with `history.replaceState` (synced with the Next router), and
 * neighbors are preloaded so the swap is usually instant.
 */
export function SpaceViewer({ initial, username, profile, signedIn, commentsOpen }: SpaceViewerProps) {
  const [view, setView] = useState(initial);
  const [views, setViews] = useState<Record<string, SpaceView>>({ [initial.space.id]: initial });
  const inflight = useRef(new Map<string, Promise<SpaceView | null>>());
  const [pending, startTransition] = useTransition();
  const { space, isOwner } = view;
  const title = spaceDisplayTitle(space, `@${username}`);

  const load = useCallback(
    (id: string) => {
      let p = inflight.current.get(id);
      if (!p) {
        p = loadSpaceView({ id, username })
          .then((r) => (r.ok ? r.view : null))
          .catch(() => null);
        inflight.current.set(id, p);
        p.then((v) => {
          if (v) setViews((prev) => ({ ...prev, [id]: v }));
          // Failed loads can be retried on the next attempt.
          else inflight.current.delete(id);
        });
      }
      return p;
    },
    [username]
  );

  const show = useCallback(
    (next: SpaceView) => {
      setView(next);
      window.history.replaceState(null, "", `/${username}/space/${next.space.id}`);
      document.title = `${spaceDisplayTitle(next.space, `@${username}`)} | Nandzz`;
    },
    [username]
  );

  const navigate = useCallback(
    (id: string) => {
      const cached = views[id];
      if (cached) return show(cached);
      startTransition(async () => {
        const next = await load(id);
        if (next) startTransition(() => show(next));
      });
    },
    [views, load, show]
  );

  // Preload both neighbors (data + image bytes) of whatever is on screen.
  useEffect(() => {
    for (const id of [view.prevId, view.nextId]) {
      if (!id) continue;
      load(id).then((v) => {
        if (v?.space.image_url) new Image().src = v.space.image_url;
      });
    }
  }, [view.prevId, view.nextId, load]);

  const onPrev = view.prevId ? () => navigate(view.prevId!) : null;
  const onNext = view.nextId ? () => navigate(view.nextId!) : null;

  // Neighbor panels for the swipe track: image URL, undefined while loading,
  // null when there's no sibling that way.
  const neighborImage = (id: string | null) =>
    id === null ? null : views[id] ? views[id].space.image_url : undefined;

  const imageOnly = !!space.image_url && !view.htmlMode && !space.pdf_url;

  return (
    <div
      className="chrome-immersive-space fixed left-0 right-0 flex flex-col overflow-hidden md:static md:h-[calc(100dvh-4rem)]"
      // Logged-out visitors get no mobile tab bar here, so there's nothing to clear.
      style={{
        top: "env(safe-area-inset-top, 0px)",
        bottom: signedIn ? "calc(4rem + env(safe-area-inset-bottom, 0px))" : "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <IdleChromeActivator />
      <ViewTracker key={space.id} spaceId={space.id} ownerId={space.user_id} />
      {/* Top bar */}
      <div className="space-viewer-topbar shrink-0 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 pl-4 pr-6 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <BackButton />
            <div className="h-4 w-px bg-border shrink-0" />
            <h1 className="font-semibold truncate">{title}</h1>
          </div>
          <div key={space.id} className="flex items-center gap-3 shrink-0">
            <LikeButton
              spaceId={space.id}
              initialLikesCount={space.likes_count}
              initialLiked={view.liked}
              size="md"
            />
            <CommentsController
              spaceId={space.id}
              spaceOwnerId={space.user_id}
              commentsCount={space.comments_count}
              userId={view.viewerId}
              currentProfile={view.currentProfile}
              initialComments={view.initialComments}
              initialHasMore={view.initialHasMore}
              initialOpen={commentsOpen && space.id === initial.space.id}
            />
            {!isOwner && (
              <StarButton spaceId={space.id} spaceTitle={title} initialSaved={view.saved} size="md" />
            )}
            {!isOwner && space.is_public && (
              <DuplicateSpaceButton spaceId={space.id} size="md" />
            )}
            <ShareMenu url={`/${username}/space/${space.id}`} title={title} size="md" />
            <Link
              href={`/${profile.username}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Avatar className="h-6 w-6 border border-border/50">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                  {(profile.display_name || profile.username)?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline">
                {(profile.display_name || profile.username || "")
                  .split(" ")
                  .filter(Boolean)
                  .map((w) => w[0].toUpperCase() + ".")
                  .join("")}
              </span>
            </Link>
            {space.url && !space.html_url && (
              <Link href={`/go?url=${encodeURIComponent(space.url)}`}>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-border/60 hover:border-violet-500/50 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Open Original</span>
                </Button>
              </Link>
            )}
            {space.video_url && (
              <a href={space.video_url} target="_blank" rel="noopener noreferrer">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-border/60 hover:border-violet-500/50 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Open Video</span>
                </Button>
              </a>
            )}
            {space.pdf_url && (
              <a href={space.pdf_url} target="_blank" rel="noopener noreferrer" download>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-border/60 hover:border-violet-500/50 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Download PDF</span>
                </Button>
              </a>
            )}
            {!isOwner && (
              <ReportLink path={`/${username}/space/${space.id}`} className="px-2" />
            )}
            {isOwner && (
              <SpaceOwnerMenu
                spaceId={space.id}
                editHref={`/dashboard/contents/edit-space/${space.id}`}
                redirectTo={`/${username}`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile download warning — only for HTML spaces with download patterns */}
      {view.downloadWarning && (
        <div className="sm:hidden shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
          <Smartphone className="h-3.5 w-3.5 shrink-0" />
          <span>Downloads may not work on mobile. Open on desktop for the full experience.</span>
        </div>
      )}

      {/* Content */}
      <div className="relative flex-1 bg-muted/50 min-h-0 overscroll-contain">
        {imageOnly ? (
          <ImageSwipeTrack
            key={space.id}
            src={space.image_url!}
            alt={spaceDisplayTitle(space)}
            prev={neighborImage(view.prevId)}
            next={neighborImage(view.nextId)}
            onCommit={(dir) => navigate((dir === "prev" ? view.prevId : view.nextId)!)}
          />
        ) : (
          <SpaceBody key={space.id} view={view} />
        )}
        <SpaceSiblingNav onPrev={onPrev} onNext={onNext} pending={pending} />
      </div>
    </div>
  );
}

function SpaceBody({ view }: { view: SpaceView }) {
  const { space, isOwner } = view;

  if (view.htmlMode) {
    return isOwner ? (
      <HtmlSpaceEditor spaceId={space.id} htmlUrl={space.html_url!} spaceTitle={space.title} />
    ) : (
      <IframeLoader
        src={`/sandbox/${space.id}`}
        title={space.title}
        sandbox="allow-scripts allow-forms allow-downloads allow-popups"
      />
    );
  }
  if (space.pdf_url) return <PdfViewerWrapper url={space.pdf_url} title={space.title} />;
  // Legacy rows only — video URLs now live in the `url` column below.
  if (space.video_url) return <VideoEmbed url={space.video_url} />;
  if (space.markdown_content) {
    return isOwner
      ? <MarkdownSpaceEditor spaceId={space.id} initialContent={space.markdown_content} />
      : <MarkdownViewer content={space.markdown_content} />;
  }
  if (space.url) {
    return detectVideo(space.url) ? (
      <VideoEmbed url={space.url} />
    ) : (
      <IframeLoader src={space.url} title={space.title} sandbox="allow-scripts allow-forms allow-popups" />
    );
  }
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">No content available</p>
    </div>
  );
}
