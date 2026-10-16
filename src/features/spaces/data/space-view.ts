import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSpaceLiked } from "@/features/social/server";
import { getSpaceSaved } from "@/features/collections/server";
import { getTopLevelComments, getLikedCommentIds } from "@/features/comments/server";
import { isOwnSpaceHtmlUrl } from "@/lib/spaces/html-url";
import type { SpaceView, ViewerProfile, ViewerSpace } from "../view-types";
import { getSpaceNeighbors } from "./neighbors";

const COMMENTS_PAGE_SIZE = 20;

type SpaceRow = ViewerSpace & {
  created_at: string;
  content_type: string | null;
  likes_count: number | null;
  comments_count: number | null;
};

function hasDownloadableContent(html: string): boolean {
  return (
    /<a[^>]+\bdownload\b/i.test(html) ||
    /\.download\s*=/i.test(html) ||
    /createObjectURL/i.test(html) ||
    /saveAs\s*\(/i.test(html)
  );
}

// Server-only: everything the viewer needs for one space, for the current
// viewer. Callers have already checked the space is public or owned by them.
export async function buildSpaceView(
  supabase: SupabaseClient,
  space: SpaceRow,
  userId: string | null
): Promise<SpaceView> {
  const isOwner = userId === space.user_id;
  const htmlUrl = isOwnSpaceHtmlUrl(space.html_url, space.user_id) ? space.html_url : null;

  const [rawComments, liked, saved, currentProfile, neighbors, html] = await Promise.all([
    getTopLevelComments(supabase, space.id, COMMENTS_PAGE_SIZE),
    userId ? getSpaceLiked(supabase, space.id, userId) : false,
    userId ? getSpaceSaved(supabase, userId, space.id) : false,
    userId
      ? supabase
          .from("profiles")
          .select("username, display_name, avatar_url")
          .eq("id", userId)
          .single()
          .then(({ data }) => data as ViewerProfile | null)
      : null,
    // Left/right browsing within the same profile section (public spaces only).
    space.is_public ? getSpaceNeighbors(supabase, space) : { prevId: null, nextId: null },
    htmlUrl
      ? fetch(htmlUrl, { cache: "no-store" })
          .then((res) => res.text())
          .catch(() => null)
      : null,
  ]);

  const likedCommentIds = new Set(
    userId && rawComments.length
      ? await getLikedCommentIds(supabase, userId, rawComments.map((c) => c.id))
      : []
  );

  return {
    space: {
      id: space.id,
      user_id: space.user_id,
      title: space.title,
      description: space.description,
      is_public: space.is_public,
      likes_count: space.likes_count ?? 0,
      comments_count: space.comments_count ?? 0,
      url: space.url,
      html_url: space.html_url,
      video_url: space.video_url,
      pdf_url: space.pdf_url,
      image_url: space.image_url,
      markdown_content: space.markdown_content,
    },
    viewerId: userId,
    isOwner,
    liked,
    saved,
    initialComments: rawComments.map((c) => ({ ...c, liked: likedCommentIds.has(c.id) })),
    initialHasMore: rawComments.length === COMMENTS_PAGE_SIZE,
    currentProfile,
    prevId: neighbors.prevId,
    nextId: neighbors.nextId,
    htmlMode: !!html,
    downloadWarning: !!html && !isOwner && hasDownloadableContent(html),
  };
}
