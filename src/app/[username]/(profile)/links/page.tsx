import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPublicProfile, redirectToCanonicalUsername } from "@/features/profile/server";
import { ProfileStyleRoot } from "@/features/profile";
import { profileStyleFromRow } from "@/features/profile/domain/style";
import { LinkChip } from "@/components/profile/LinkChip";
import { Button } from "@/components/ui/button";
import { getServerTranslations } from "@/lib/i18n/server";
import { PageShell } from "@/components/layout/PageShell";

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
      canonical: `https://nandzz.com/${profile.username}/links`,
    },
  };
}

export default async function ProfileLinksPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { username } = await params;
  const { page } = await searchParams;
  redirectToCanonicalUsername(username, "/links" + (page ? `?page=${encodeURIComponent(page)}` : ""));

  const profile = await getPublicProfile(username);
  if (!profile) {
    notFound();
  }

  // Gated by the owner's `show_links` visibility flag.
  const showLinks = profile.show_links ?? true;
  if (!showLinks) {
    notFound();
  }

  const currentPage = Math.max(1, parseInt(page || "1", 10) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [supabase, t] = await Promise.all([createClient(), getServerTranslations()]);

  const { data: links, count } = await supabase
    .from("spaces")
    .select("*", { count: "exact" })
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .in("content_type", ["link", "video"])
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);
  // A stale/hand-typed `?page=` past the end (e.g. after deletions) lands on
  // the last real page instead of an empty grid.
  if (totalPages > 0 && currentPage > totalPages) {
    redirect(`/${profile.username}/links?page=${totalPages}`);
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
            {t.profile.linksTitle}
            <span className="ml-2 text-base font-normal text-muted-foreground tabular-nums">
              {count ?? 0}
            </span>
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {(links || []).map((space, i) => (
            <LinkChip key={space.id} space={space} priority={i < 4} />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {currentPage > 1 && (
              <Link href={`/${profile.username}/links?page=${currentPage - 1}`}>
                <Button variant="outline" size="sm" className="border-border/60">
                  {t.explore.previous}
                </Button>
              </Link>
            )}
            <span className="px-3 text-sm text-muted-foreground">
              {t.explore.pageOf.replace("{current}", String(currentPage)).replace("{total}", String(totalPages))}
            </span>
            {currentPage < totalPages && (
              <Link href={`/${profile.username}/links?page=${currentPage + 1}`}>
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
