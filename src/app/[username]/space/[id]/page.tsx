import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LikeButton } from "@/components/spaces/LikeButton";
import { ShareMenu } from "@/components/spaces/ShareMenu";
import { StarButton } from "@/components/spaces/StarButton";
import { SpaceOwnerMenu } from "@/components/spaces/SpaceOwnerMenu";
import { ExternalLink, Lock, Smartphone } from "lucide-react";
import { CommentsController } from "@/components/spaces/comments/CommentsController";
import type { CommentWithLike } from "@/lib/types";
import { HtmlSpaceEditor } from "@/components/spaces/HtmlSpaceEditor";
import { PdfViewerWrapper } from "@/components/spaces/PdfViewerWrapper";
import { IframeLoader } from "@/components/spaces/IframeLoader";
import { VideoEmbed } from "@/components/spaces/VideoEmbed";
import { MarkdownViewer } from "@/components/spaces/MarkdownViewer";
import { MarkdownSpaceEditor } from "@/components/spaces/MarkdownSpaceEditor";
import { BackButton } from "@/components/ui/BackButton";
import { ViewTracker } from "@/components/spaces/ViewTracker";

function hasDownloadableContent(html: string): boolean {
  return (
    /<a[^>]+\bdownload\b/i.test(html) ||
    /\.download\s*=/i.test(html) ||
    /createObjectURL/i.test(html) ||
    /saveAs\s*\(/i.test(html)
  );
}

// react.cache deduplicates within a single request (generateMetadata + page share one DB hit)
// No cross-request caching — space data must always be fresh (is_public changes take effect immediately)
const getSpace = cache(async (id: string) => {
  await connection();
  const admin = createAdminClient();
  const { data } = await admin
    .from("spaces")
    .select("*, profiles(username, display_name, avatar_url)")
    .eq("id", id)
    .single();
  return data;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; id: string }>;
}): Promise<Metadata> {
  const { id, username } = await params;
  let space: Awaited<ReturnType<typeof getSpace>>;
  try {
    space = await getSpace(id);
  } catch {
    return { title: "Space — Nandzz" };
  }

  if (!space) return { title: "Space Not Found — Nandzz" };

  const profile = space.profiles as unknown as {
    display_name: string | null;
    username: string | null;
  } | null;

  // 404 if space doesn't belong to the username in the URL
  if (profile?.username !== username) return { title: "Space Not Found — Nandzz" };

  if (!space.is_public) return { title: "Private Space — Nandzz" };

  const author = profile?.display_name || profile?.username || "Unknown";
  const description = space.description || `A web app shared by ${author} on nandzz.`;

  return {
    title: space.title,
    description,
    alternates: {
      canonical: `https://nandzz.com/${username}/space/${id}`,
    },
    openGraph: {
      title: space.title,
      description,
      type: "website",
      url: `https://nandzz.com/${username}/space/${id}`,
      siteName: "Nandzz",
      ...(space.preview_image_url && {
        images: [{ url: space.preview_image_url, alt: space.title }],
      }),
    },
    twitter: {
      card: space.preview_image_url ? "summary_large_image" : "summary",
      title: `${space.title} — Nandzz`,
      description,
      ...(space.preview_image_url && { images: [space.preview_image_url] }),
    },
  };
}

export default async function SpaceViewPage({
  params,
}: {
  params: Promise<{ username: string; id: string }>;
}) {
  const { username, id } = await params;
  const space = await getSpace(id);

  if (!space) notFound();

  const profile = space.profiles as unknown as {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;

  // Space must belong to the username in the URL
  if (profile?.username !== username) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isOwner = user?.id === space.user_id;

  // Private space — only the owner can view it
  if (!space.is_public && !isOwner) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] items-center justify-center gap-4 text-center px-4">
        <div className="flex items-center justify-center h-14 w-14 rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">This space is private</h2>
          <p className="text-sm text-muted-foreground">
            Only the owner can view this space.
          </p>
        </div>
        <Link href={`/${username}`}>
          <Button variant="outline">View profile</Button>
        </Link>
      </div>
    );
  }

  let liked = false;
  let saved = false;

  if (user) {
    const [{ data: likeData }, { data: starredCol }] = await Promise.all([
      supabase
        .from("space_likes")
        .select("id")
        .eq("user_id", user.id)
        .eq("space_id", id)
        .maybeSingle(),
      supabase
        .from("collections")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_default", true)
        .maybeSingle(),
    ]);
    liked = !!likeData;

    if (starredCol) {
      const { data: savedEntry } = await supabase
        .from("collection_spaces")
        .select("id")
        .eq("collection_id", starredCol.id)
        .eq("space_id", id)
        .maybeSingle();
      saved = !!savedEntry;
    }
  }

  // Comments: first page + current user profile for the input avatar
  const PAGE_SIZE = 20;
  const { data: rawComments } = await supabase
    .from("space_comments")
    .select("*, profiles:user_id(username, display_name, avatar_url)")
    .eq("space_id", id)
    .is("parent_id", null)
    .order("created_at", { ascending: true })
    .limit(PAGE_SIZE);

  let likedCommentIds = new Set<string>();
  let currentProfile: { username: string; display_name: string | null; avatar_url: string | null } | null = null;

  if (user) {
    const [{ data: profileData }, ..._] = await Promise.all([
      supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", user.id)
        .single(),
      rawComments?.length
        ? supabase
            .from("comment_likes")
            .select("comment_id")
            .eq("user_id", user.id)
            .in("comment_id", rawComments.map((c) => c.id))
            .then(({ data }) => {
              likedCommentIds = new Set(data?.map((l) => l.comment_id));
            })
        : Promise.resolve(null),
    ]);
    currentProfile = profileData;
  }

  const initialComments: CommentWithLike[] = (rawComments ?? []).map((c) => ({
    ...c,
    profiles: c.profiles as CommentWithLike["profiles"],
    liked: likedCommentIds.has(c.id),
  }));
  const initialHasMore = (rawComments?.length ?? 0) === PAGE_SIZE;

  let htmlContent: string | null = null;
  if (space.html_url) {
    try {
      const res = await fetch(space.html_url, { cache: "no-store" });
      htmlContent = await res.text();
    } catch {
      // fall through — no content available
    }
  }

  return (
    <div
      className="fixed left-0 right-0 flex flex-col overflow-hidden md:static md:h-[calc(100dvh-4rem)]"
      style={{ top: '4rem', bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <ViewTracker spaceId={space.id} ownerId={space.user_id} />
      {/* Top bar */}
      <div className="shrink-0 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <BackButton />
          <div className="h-4 w-px bg-border shrink-0" />
          <h1 className="font-semibold truncate">{space.title}</h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <LikeButton
            spaceId={space.id}
            initialLikesCount={space.likes_count ?? 0}
            initialLiked={liked}
            size="md"
          />
          <CommentsController
            spaceId={space.id}
            commentsCount={space.comments_count ?? 0}
            userId={user?.id ?? null}
            currentProfile={currentProfile}
            initialComments={initialComments}
            initialHasMore={initialHasMore}
          />
          {!isOwner && (
            <StarButton spaceId={space.id} initialSaved={saved} size="md" />
          )}
          <ShareMenu url={`/${username}/space/${space.id}`} title={space.title} size="md" />
          {profile && (
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
          )}
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
          {isOwner && (
            <SpaceOwnerMenu
              spaceId={space.id}
              editHref={`/dashboard/edit-space/${space.id}`}
              redirectTo={`/${username}`}
            />
          )}
        </div>
      </div>
      </div>

      {/* Mobile download warning — only for HTML spaces with download patterns */}
      {htmlContent && !isOwner && hasDownloadableContent(htmlContent) && (
        <div className="sm:hidden shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
          <Smartphone className="h-3.5 w-3.5 shrink-0" />
          <span>Downloads may not work on mobile. Open on desktop for the full experience.</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 bg-muted/50 min-h-0 overscroll-contain">
        {htmlContent ? (
          isOwner ? (
            <HtmlSpaceEditor
              spaceId={space.id}
              htmlUrl={space.html_url!}
              spaceTitle={space.title}
            />
          ) : (
            <IframeLoader
              src={`/sandbox/${space.id}`}
              title={space.title}
              sandbox="allow-scripts allow-forms allow-downloads allow-popups"
            />
          )
        ) : space.pdf_url ? (
          <PdfViewerWrapper url={space.pdf_url} title={space.title} />
        ) : space.image_url ? (
          <div className="flex h-full items-center justify-center bg-black/90 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={space.image_url}
              alt={space.title}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        ) : space.video_url ? (
          <VideoEmbed url={space.video_url} />
        ) : space.markdown_content ? (
          isOwner
            ? <MarkdownSpaceEditor spaceId={space.id} initialContent={space.markdown_content} />
            : <MarkdownViewer content={space.markdown_content} />
        ) : space.url ? (
          <IframeLoader
            src={space.url}
            title={space.title}
            sandbox="allow-scripts allow-forms allow-popups"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">No content available</p>
          </div>
        )}
      </div>
    </div>
  );
}
