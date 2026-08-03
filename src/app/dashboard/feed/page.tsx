export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SpaceGrid } from "@/components/spaces/SpaceGrid";
import { Button } from "@/components/ui/button";
import { Compass, Rss } from "lucide-react";
import type { SpaceWithProfile } from "@/lib/types";
import { getServerTranslations } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Feed | Nandzz",
  description: "Spaces from people you follow.",
};

const PAGE_SIZE = 24;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const t = await getServerTranslations();
  const { page } = await searchParams;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: follows } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", user.id);

  const followingIds = (follows ?? []).map((f) => f.following_id);

  let spaces: SpaceWithProfile[] = [];
  let likedSpaceIds: string[] = [];
  let totalPages = 0;

  const currentPage = Math.max(1, parseInt(page || "1", 10) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  if (followingIds.length > 0) {
    const [{ data: rawSpaces, count }, { data: likes }] = await Promise.all([
      supabase
        .from("spaces")
        .select("*, profiles(username, display_name, avatar_url)", { count: "exact" })
        .in("user_id", followingIds)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .range(from, to),
      supabase
        .from("space_likes")
        .select("space_id")
        .eq("user_id", user.id),
    ]);

    spaces = (rawSpaces ?? []) as SpaceWithProfile[];
    likedSpaceIds = (likes ?? []).map((l) => l.space_id);
    totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);
  }

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-0 top-0 h-[300px] w-[300px] rounded-full bg-violet-100/30 blur-3xl dark:bg-violet-950/15" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
            <Rss className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t.feed.title}</h1>
            <p className="text-muted-foreground">{t.feed.subtitle}</p>
          </div>
        </div>

        {followingIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-100/80 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800">
              <Compass className="h-10 w-10 text-violet-400 dark:text-violet-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t.feed.emptyTitle}</h2>
            <p className="text-muted-foreground max-w-sm mb-6">
              {t.feed.emptyDesc}
            </p>
            <Link href="/explore">
              <Button>
                <Compass className="h-4 w-4 mr-2" />
                {t.feed.exploreCreators}
              </Button>
            </Link>
          </div>
        ) : spaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-muted-foreground">
              {t.feed.noPublic}
            </p>
          </div>
        ) : (
          <>
            <SpaceGrid
              spaces={spaces}
              showAuthor
              likedSpaceIds={likedSpaceIds}
              currentUserId={user.id}
            />
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                {currentPage > 1 && (
                  <Link href={`/dashboard/feed?page=${currentPage - 1}`}>
                    <Button variant="outline" size="sm" className="border-border/60">
                      {t.feed.previous}
                    </Button>
                  </Link>
                )}
                <span className="px-3 text-sm text-muted-foreground">
                  {t.feed.pageOf.replace("{current}", String(currentPage)).replace("{total}", String(totalPages))}
                </span>
                {currentPage < totalPages && (
                  <Link href={`/dashboard/feed?page=${currentPage + 1}`}>
                    <Button variant="outline" size="sm" className="border-border/60">
                      {t.feed.next}
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
