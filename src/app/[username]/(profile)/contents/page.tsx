import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPublicProfile, redirectToCanonicalUsername } from "@/features/profile/server";
import { ProfileStyleRoot } from "@/features/profile";
import { profileStyleFromRow } from "@/features/profile/domain/style";
import { SpaceGrid } from "@/features/spaces";
import { Button } from "@/components/ui/button";
import { getServerTranslations } from "@/lib/i18n/server";
import { PageShell } from "@/components/layout/PageShell";
import { getLikedSpaceIds } from "@/features/social/server";
import { getSavedSpaceIds } from "@/features/collections/server";

const PAGE_SIZE = 24;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);

  if (!profile) {
    return {};
  }

  const name = profile.display_name || profile.username;

  return {
    title: `${name} (@${profile.username})`,
    alternates: {
      canonical: `https://nandzz.com/${profile.username}/contents`,
    },
  };
}

export default async function ProfileContentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { username } = await params;
  const { page } = await searchParams;
  redirectToCanonicalUsername(username, "/contents" + (page ? `?page=${encodeURIComponent(page)}` : ""));

  const profile = await getPublicProfile(username);
  if (!profile) {
    notFound();
  }

  // Publications = informative content only (the Links section has its own
  // /links route). Gated by the owner's `show_contents` flag.
  const showContents = profile.show_contents ?? true;
  if (!showContents) {
    notFound();
  }

  const currentPage = Math.max(1, parseInt(page || "1", 10) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [supabase, t] = await Promise.all([createClient(), getServerTranslations()]);

  const [{ data: spaces, count }, { data: { user } }] = await Promise.all([
    supabase
      .from("spaces")
      .select("*", { count: "exact" })
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .neq("content_type", "image") // images live in the gallery
      .neq("content_type", "link") // links live in the /links section
      .neq("content_type", "video")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to),
    supabase.auth.getUser(),
  ]);

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);
  // A stale/hand-typed `?page=` past the end (e.g. after deletions) lands on
  // the last real page instead of an empty grid.
  if (totalPages > 0 && currentPage > totalPages) {
    redirect(`/${profile.username}/contents?page=${totalPages}`);
  }

  let likedSpaceIds: string[] = [];
  let savedSpaceIds: string[] = [];

  if (user && spaces && spaces.length > 0) {
    const spaceIds = spaces.map((s) => s.id);

    const [likes, saved] = await Promise.all([
      getLikedSpaceIds(supabase, user.id, spaceIds),
      getSavedSpaceIds(supabase, user.id, spaceIds),
    ]);

    likedSpaceIds = likes;
    savedSpaceIds = saved;
  }

  const displayName = profile.display_name || profile.username;

  return (
    // Same page color + light/dark lock as the profile itself, so "See more"
    // doesn't drop the owner's style.
    <ProfileStyleRoot
      initial={profileStyleFromRow(profile)}
      isOwner={false}
      className="relative min-h-[calc(100vh-8rem)]"
    >
      <PageShell width="wide">
        <div className="mb-8">
          <Link
            href={`/${profile.username}`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {displayName}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            {t.profile.contentsTitle}
            <span className="ml-2 text-base font-normal text-muted-foreground tabular-nums">
              {count ?? 0}
            </span>
          </h1>
        </div>

        <SpaceGrid
          spaces={spaces || []}
          likedSpaceIds={likedSpaceIds}
          savedSpaceIds={savedSpaceIds}
          currentUserId={user?.id}
          ownerUsername={profile.username}
        />

        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {currentPage > 1 && (
              <Link href={`/${profile.username}/contents?page=${currentPage - 1}`}>
                <Button variant="outline" size="sm" className="border-border/60">
                  {t.explore.previous}
                </Button>
              </Link>
            )}
            <span className="px-3 text-sm text-muted-foreground">
              {t.explore.pageOf.replace("{current}", String(currentPage)).replace("{total}", String(totalPages))}
            </span>
            {currentPage < totalPages && (
              <Link href={`/${profile.username}/contents?page=${currentPage + 1}`}>
                <Button variant="outline" size="sm" className="border-border/60">
                  {t.explore.next}
                </Button>
              </Link>
            )}
          </div>
        )}
      </PageShell>
    </ProfileStyleRoot>
  );
}
