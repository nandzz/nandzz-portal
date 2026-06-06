import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SpaceGrid } from "@/components/spaces/SpaceGrid";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/explore/SearchBar";
import { Compass, Plus } from "lucide-react";
import { getServerTranslations } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Explore Spaces",
  description:
    "Discover web apps, interactive tools, PDFs, and AI-generated creations shared by the nandzz community.",
  openGraph: {
    title: "Explore Spaces — Nandzz",
    description:
      "Discover web apps, interactive tools, PDFs, and AI-generated creations shared by the community.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Explore Spaces — Nandzz",
    description: "Discover web apps and AI creations shared by the nandzz community.",
  },
};

const PAGE_SIZE = 24;

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page, q } = await searchParams;
  const query = q?.trim() ?? "";
  const currentPage = Math.max(1, parseInt(page || "1", 10) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [supabase, t] = await Promise.all([createClient(), getServerTranslations()]);

  let dbQuery = supabase
    .from("spaces")
    .select("*, profiles(username, display_name, avatar_url)", { count: "exact" })
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (query) {
    dbQuery = dbQuery.textSearch("search_vector", query, {
      type: "websearch",
      config: "english",
    });
  }

  const { data: spaces, count } = await dbQuery;

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  const { data: { user } } = await supabase.auth.getUser();
  let likedSpaceIds: string[] = [];
  let savedSpaceIds: string[] = [];

  if (spaces && spaces.length > 0) {
    const spaceIds = spaces.map(s => s.id);

    const fetchLikes = user
      ? supabase.from("space_likes").select("space_id").eq("user_id", user.id).in("space_id", spaceIds)
      : Promise.resolve({ data: null });

    const fetchStarred = user
      ? supabase.from("collections").select("id").eq("user_id", user.id).eq("is_default", true).maybeSingle()
      : Promise.resolve({ data: null });

    const [likesRes, starredRes] = await Promise.all([fetchLikes, fetchStarred]);

    likedSpaceIds = likesRes.data?.map((l: { space_id: string }) => l.space_id) || [];

    if (starredRes.data) {
      const { data: savedEntries } = await supabase
        .from("collection_spaces")
        .select("space_id")
        .eq("collection_id", starredRes.data.id)
        .in("space_id", spaceIds);
      savedSpaceIds = savedEntries?.map((e: { space_id: string }) => e.space_id) || [];
    }
  }

  const resultCount = count ?? 0;
  const resultLabel = resultCount === 1 ? t.explore.resultSingular : t.explore.resultPlural;

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-violet-100/40 blur-3xl dark:bg-violet-950/20" />
        <div className="absolute left-0 bottom-0 h-[300px] w-[300px] rounded-full bg-fuchsia-100/30 blur-3xl dark:bg-fuchsia-950/15" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
              <Compass className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t.explore.title}
            </h1>
          </div>
          <p className="mt-2 text-muted-foreground text-lg">
            {t.explore.subtitle}
          </p>
        </div>

        {/* Search */}
        <div className="mb-8 flex items-center gap-4">
          <SearchBar />
          {query && (
            <p className="text-sm text-muted-foreground shrink-0">
              {resultCount} {resultLabel} {t.explore.resultFor} &ldquo;{query}&rdquo;
            </p>
          )}
        </div>

        {spaces && spaces.length > 0 ? (
          <>
            <SpaceGrid spaces={spaces} showAuthor likedSpaceIds={likedSpaceIds} savedSpaceIds={savedSpaceIds} currentUserId={user?.id} />
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                {currentPage > 1 && (
                  <Link href={`/explore?${query ? `q=${encodeURIComponent(query)}&` : ""}page=${currentPage - 1}`}>
                    <Button variant="outline" size="sm" className="border-border/60">
                      {t.explore.previous}
                    </Button>
                  </Link>
                )}
                <span className="px-3 text-sm text-muted-foreground">
                  {t.explore.pageOf.replace("{current}", String(currentPage)).replace("{total}", String(totalPages))}
                </span>
                {currentPage < totalPages && (
                  <Link href={`/explore?${query ? `q=${encodeURIComponent(query)}&` : ""}page=${currentPage + 1}`}>
                    <Button variant="outline" size="sm" className="border-border/60">
                      {t.explore.next}
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-100/80 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800">
              <Compass className="h-10 w-10 text-violet-400 dark:text-violet-500" />
            </div>
            {query ? (
              <>
                <h2 className="text-xl font-semibold mb-2">{t.explore.noResultsTitle}</h2>
                <p className="text-muted-foreground max-w-sm">
                  {t.explore.noResultsDesc.replace("{query}", query)}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-2">{t.explore.noSpacesTitle}</h2>
                <p className="text-muted-foreground max-w-sm mb-6">
                  {t.explore.noSpacesDesc}
                </p>
                <Link href={user ? "/dashboard/create-space" : "/login?tab=signup"}>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    {t.explore.createFirst}
                  </Button>
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
