export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { SpaceGrid } from "@/features/spaces";
import { Button } from "@/components/ui/button";
import { Compass, Rss } from "lucide-react";
import type { SpaceWithProfile } from "@/lib/types";
import { getServerTranslations } from "@/lib/i18n/server";
import { PageShell } from "@/components/layout/PageShell";
import {
  getFollowingFeedPage,
  getFollowsAnyone,
  getLikedSpaceIds,
  type FeedCursor,
} from "@/features/social/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslations();
  return {
    title: t.meta.feedTitle,
    description: t.meta.feedDescription,
  };
}

const PAGE_SIZE = 25;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cursor URL format: `<created_at ISO>_<space id>`. Invalid values are ignored
// (falls back to the newest page).
function parseCursor(raw: string | undefined): FeedCursor | null {
  if (!raw) return null;
  const sep = raw.lastIndexOf("_");
  if (sep < 0) return null;
  const createdAt = raw.slice(0, sep);
  const id = raw.slice(sep + 1);
  if (!UUID_RE.test(id) || Number.isNaN(Date.parse(createdAt))) return null;
  return { createdAt, id };
}

function cursorParam(space: SpaceWithProfile): string {
  return encodeURIComponent(`${space.created_at}_${space.id}`);
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string; after?: string }>;
}) {
  const supabase = await createClient();
  const t = await getServerTranslations();
  const params = await searchParams;

  const userId = await getUserIdFromClaims(supabase);
  if (!userId) redirect("/login");

  // The feed is a personal-account capability: a business gets followed and
  // booked rather than following creators, so it has no feed. Send business
  // accounts back to their content dashboard.
  const { data: me } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", userId)
    .single();
  if (me?.account_type === "business") redirect("/dashboard/contents");

  const before = parseCursor(params.before);
  const after = before ? null : parseCursor(params.after);

  const { spaces, hasOlder, hasNewer } = await getFollowingFeedPage(supabase, {
    before,
    after,
    pageSize: PAGE_SIZE,
  });

  const [likedSpaceIds, followsAnyone] = await Promise.all([
    getLikedSpaceIds(
      supabase,
      userId,
      spaces.map((s) => s.id)
    ),
    // Only the empty state needs to tell "follows nobody" from "no posts".
    spaces.length === 0 ? getFollowsAnyone(supabase, userId) : Promise.resolve(true),
  ]);

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-0 top-0 h-[300px] w-[300px] rounded-full bg-violet-100/30 blur-3xl dark:bg-violet-950/15" />
      </div>

      <PageShell width="content">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
            <Rss className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t.feed.title}</h1>
            <p className="text-muted-foreground">{t.feed.subtitle}</p>
          </div>
        </div>

        {!followsAnyone ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-100/80 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800">
              <Compass className="h-10 w-10 text-violet-400 dark:text-violet-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t.feed.emptyTitle}</h2>
            <p className="text-muted-foreground max-w-sm mb-6">
              {t.feed.emptyDesc}
            </p>
            <Link href="/">
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
              currentUserId={userId}
            />
            {(hasNewer || hasOlder) && (
              <div className="mt-10 flex items-center justify-center gap-2">
                {hasNewer && (
                  <Link href={`/dashboard/feed?after=${cursorParam(spaces[0])}`}>
                    <Button variant="outline" size="sm" className="border-border/60">
                      {t.feed.previous}
                    </Button>
                  </Link>
                )}
                {hasOlder && (
                  <Link href={`/dashboard/feed?before=${cursorParam(spaces[spaces.length - 1])}`}>
                    <Button variant="outline" size="sm" className="border-border/60">
                      {t.feed.next}
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </PageShell>
    </div>
  );
}
