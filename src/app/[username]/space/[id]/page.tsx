import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { SpaceViewer } from "@/features/spaces";
import { buildSpaceView } from "@/features/spaces/server";
import { getServerTranslations } from "@/lib/i18n/server";
import { spaceDisplayTitle } from "@/lib/spaces/display-title";

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
  const t = await getServerTranslations();
  let space: Awaited<ReturnType<typeof getSpace>>;
  try {
    space = await getSpace(id);
  } catch {
    return { title: t.meta.spaceTitleFallback };
  }

  if (!space) return { title: t.meta.spaceNotFoundTitle };

  const profile = space.profiles as unknown as {
    display_name: string | null;
    username: string | null;
  } | null;

  // 404 if space doesn't belong to the username in the URL
  if (profile?.username !== username) return { title: t.meta.spaceNotFoundTitle };

  if (!space.is_public) return { title: t.meta.privateSpaceTitle };

  const author = profile?.display_name || profile?.username || "Unknown";
  const description = space.description || t.meta.spaceDescriptionFallback.replace("{author}", author);

  const displayTitle = spaceDisplayTitle(space, author);

  return {
    title: displayTitle,
    description,
    alternates: {
      canonical: `https://nandzz.com/${username}/space/${id}`,
    },
    openGraph: {
      title: displayTitle,
      description,
      type: "website",
      url: `https://nandzz.com/${username}/space/${id}`,
      siteName: "Nandzz",
      ...(space.preview_image_url && {
        images: [{ url: space.preview_image_url, alt: displayTitle }],
      }),
    },
    twitter: {
      card: space.preview_image_url ? "summary_large_image" : "summary",
      title: `${displayTitle} | Nandzz`,
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
  if (!profile?.username || profile.username !== username) notFound();

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

  const view = await buildSpaceView(supabase, space, user?.id ?? null);

  return (
    <SpaceViewer
      initial={view}
      username={username}
      profile={{ username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url }}
      signedIn={!!user}
    />
  );
}
