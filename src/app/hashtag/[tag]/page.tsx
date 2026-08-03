import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SpaceGrid } from "@/components/spaces/SpaceGrid";
import { Button } from "@/components/ui/button";
import { Hash } from "lucide-react";
import { getServerTranslations } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const description = `Browse the latest spaces tagged #${tag} on Nandzz.`;

  const admin = createAdminClient();
  const { data: firstSpace } = await admin
    .from("spaces")
    .select("preview_image_url")
    .eq("is_public", true)
    .contains("hashtags", [tag])
    .not("preview_image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    title: `#${tag}`,
    description,
    alternates: {
      canonical: `https://nandzz.com/hashtag/${tag}`,
    },
    openGraph: {
      title: `#${tag} | Nandzz`,
      description,
      type: "website",
      url: `https://nandzz.com/hashtag/${tag}`,
      siteName: "Nandzz",
      ...(firstSpace?.preview_image_url && {
        images: [{ url: firstSpace.preview_image_url, alt: `#${tag} spaces on Nandzz` }],
      }),
    },
    twitter: {
      card: firstSpace?.preview_image_url ? "summary_large_image" : "summary",
      title: `#${tag} | Nandzz`,
      description,
      ...(firstSpace?.preview_image_url && { images: [firstSpace.preview_image_url] }),
    },
  };
}

const PAGE_SIZE = 24;

export default async function HashtagPage({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { tag } = await params;
  const { page } = await searchParams;

  // Basic slug validation — only allow lowercase alphanum + hyphens
  if (!/^[a-z0-9-]+$/.test(tag)) notFound();

  const currentPage = Math.max(1, parseInt(page || "1", 10) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [supabase, t] = await Promise.all([createClient(), getServerTranslations()]);

  const { data: spaces, count } = await supabase
    .from("spaces")
    .select("*, profiles(username, display_name, avatar_url)", { count: "exact" })
    .eq("is_public", true)
    .contains("hashtags", [tag])
    .order("created_at", { ascending: false })
    .range(from, to);

  if (!spaces) notFound();

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  const { data: { user } } = await supabase.auth.getUser();
  let likedSpaceIds: string[] = [];
  let savedSpaceIds: string[] = [];

  if (user && spaces.length > 0) {
    const spaceIds = spaces.map((s) => s.id);

    const fetchLikes = supabase
      .from("space_likes")
      .select("space_id")
      .eq("user_id", user.id)
      .in("space_id", spaceIds);

    const fetchSaved = supabase
      .from("collection_spaces")
      .select("space_id, collections!inner(user_id)")
      .eq("collections.user_id", user.id)
      .in("space_id", spaceIds);

    const [likesRes, savedRes] = await Promise.all([fetchLikes, fetchSaved]);

    likedSpaceIds = likesRes.data?.map((l: { space_id: string }) => l.space_id) || [];
    savedSpaceIds = [...new Set((savedRes.data ?? []).map((e: { space_id: string }) => e.space_id))];
  }

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-violet-100/40 blur-3xl dark:bg-violet-950/20" />
        <div className="absolute left-0 bottom-0 h-[300px] w-[300px] rounded-full bg-fuchsia-100/30 blur-3xl dark:bg-fuchsia-950/15" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
              <Hash className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">#{tag}</h1>
          </div>
          <p className="mt-2 text-muted-foreground text-lg">
            {(count ?? 0) === 1
              ? t.hashtag.spacesSingular.replace("{count}", String(count ?? 0))
              : t.hashtag.spacesPlural.replace("{count}", String(count ?? 0))}
          </p>
        </div>

        {spaces.length > 0 ? (
          <>
            <SpaceGrid
              spaces={spaces}
              showAuthor
              likedSpaceIds={likedSpaceIds}
              savedSpaceIds={savedSpaceIds}
              currentUserId={user?.id}
            />
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                {currentPage > 1 && (
                  <Link href={`/hashtag/${tag}?page=${currentPage - 1}`}>
                    <Button variant="outline" size="sm" className="border-border/60">
                      {t.hashtag.previous}
                    </Button>
                  </Link>
                )}
                <span className="px-3 text-sm text-muted-foreground">
                  {t.hashtag.pageOf.replace("{current}", String(currentPage)).replace("{total}", String(totalPages))}
                </span>
                {currentPage < totalPages && (
                  <Link href={`/hashtag/${tag}?page=${currentPage + 1}`}>
                    <Button variant="outline" size="sm" className="border-border/60">
                      {t.hashtag.next}
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-100/80 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800">
              <Hash className="h-10 w-10 text-violet-400 dark:text-violet-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t.hashtag.noTitle}</h2>
            <p className="text-muted-foreground max-w-sm mb-6">
              {t.hashtag.noDesc.replace("{tag}", tag)}
            </p>
            <Link href="/explore">
              <Button variant="outline">{t.hashtag.browse}</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
