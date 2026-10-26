import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPublicProfile, redirectToCanonicalUsername } from "@/features/profile/server";
// Direct paths, not the barrels: from a Server Component a barrel turns every
// client component it exports into client code for this page.
import { ProfileStyleRoot } from "@/features/profile/components/ProfileStyleRoot";
import { profileStyleFromRow } from "@/features/profile/domain/style";
import { ProfileGallery } from "@/components/profile/ProfileGallery";
import { Button } from "@/components/ui/button";
import { getServerTranslations } from "@/lib/i18n/server";
import { PageShell } from "@/components/layout/PageShell";
import { resolveGalleryLayout } from "@/lib/gallery/layouts";

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
      canonical: `https://nandzz.com/${profile.username}/gallery`,
    },
  };
}

export default async function ProfileGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { username } = await params;
  const { page } = await searchParams;
  redirectToCanonicalUsername(username, "/gallery" + (page ? `?page=${encodeURIComponent(page)}` : ""));

  const profile = await getPublicProfile(username);
  if (!profile) {
    notFound();
  }
  // Respect the owner's public visibility flag for the gallery.
  if ((profile.show_gallery ?? true) === false) {
    notFound();
  }

  const currentPage = Math.max(1, parseInt(page || "1", 10) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [supabase, t] = await Promise.all([createClient(), getServerTranslations()]);

  const [{ data: images, count }, { data: { user } }] = await Promise.all([
    supabase
      .from("spaces")
      .select("*", { count: "exact" })
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .eq("content_type", "image")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to),
    supabase.auth.getUser(),
  ]);

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);
  // A stale/hand-typed `?page=` past the end (e.g. after deletions) lands on
  // the last real page instead of an empty grid.
  if (totalPages > 0 && currentPage > totalPages) {
    redirect(`/${profile.username}/gallery?page=${totalPages}`);
  }

  const isOwner = user?.id === profile.id;

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
        </div>

        <ProfileGallery
          images={images || []}
          totalCount={count ?? images?.length ?? 0}
          profile={profile}
          isOwner={isOwner}
          initialLayout={resolveGalleryLayout(profile)}
        />

        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {currentPage > 1 && (
              <Link href={`/${profile.username}/gallery?page=${currentPage - 1}`}>
                <Button variant="outline" size="sm" className="border-border/60">
                  {t.explore.previous}
                </Button>
              </Link>
            )}
            <span className="px-3 text-sm text-muted-foreground">
              {t.explore.pageOf.replace("{current}", String(currentPage)).replace("{total}", String(totalPages))}
            </span>
            {currentPage < totalPages && (
              <Link href={`/${profile.username}/gallery?page=${currentPage + 1}`}>
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
