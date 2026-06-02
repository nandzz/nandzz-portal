import type { Metadata } from "next";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { ProfileBackground } from "@/components/profile/ProfileBackground";

const fetchProfileCached = unstable_cache(
  async (username: string) => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("*")
      .eq("username", username)
      .single();
    return data;
  },
  ["profile"],
  { revalidate: 60 }
);

// react.cache deduplicates within a single request so generateMetadata and ProfilePage share one DB hit
const getProfile = cache(fetchProfileCached);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) {
    return { title: "Profile Not Found — Nandzz" };
  }

  const name = profile.display_name || profile.username;

  const description = profile.tagline || `Check out ${name}'s web apps on nandzz.`;

  return {
    title: `${name} (@${profile.username})`,
    description,
    alternates: {
      canonical: `https://nandzz.com/${profile.username}`,
    },
    openGraph: {
      title: `${name} (@${profile.username})`,
      description,
      type: "profile",
      url: `https://nandzz.com/${profile.username}`,
      siteName: "Nandzz",
      ...(profile.avatar_url && {
        images: [{ url: profile.avatar_url, alt: `${name}'s avatar` }],
      }),
    },
    twitter: {
      card: "summary",
      title: `${name} (@${profile.username}) — Nandzz`,
      description,
      ...(profile.avatar_url && { images: [profile.avatar_url] }),
    },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const profile = await getProfile(username);

  if (!profile) {
    notFound();
  }

  const supabase = await createClient();

  const [
    { data: spaces },
    { data: collections },
    { data: { user } },
  ] = await Promise.all([
    supabase
      .from("spaces")
      .select("*")
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("collections")
      .select("*, collection_spaces(space_id, spaces(*))")
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  let likedSpaceIds: string[] = [];
  let savedSpaceIds: string[] = [];
  let isFollowing = false;

  if (user) {
    // Collect all space IDs visible on this profile: owner's spaces + collection spaces
    const ownerSpaceIds = (spaces ?? []).map(s => s.id);
    const collectionSpaceIds = (collections ?? [])
      .flatMap(c => c.collection_spaces.map((cs: { space_id: string }) => cs.space_id));
    const allSpaceIds = [...new Set([...ownerSpaceIds, ...collectionSpaceIds])];

    if (user.id !== profile.id) {
      const { data: followRow } = await supabase
        .from("user_follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", profile.id)
        .maybeSingle();
      isFollowing = !!followRow;
    }

    if (allSpaceIds.length > 0) {
      const [{ data: likes }, { data: starredCol }] = await Promise.all([
        supabase
          .from("space_likes")
          .select("space_id")
          .eq("user_id", user.id)
          .in("space_id", allSpaceIds),
        supabase
          .from("collections")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_default", true)
          .maybeSingle(),
      ]);
      likedSpaceIds = likes?.map(l => l.space_id) || [];

      if (starredCol) {
        const { data: savedEntries } = await supabase
          .from("collection_spaces")
          .select("space_id")
          .eq("collection_id", starredCol.id)
          .in("space_id", allSpaceIds);
        savedSpaceIds = savedEntries?.map(e => e.space_id) || [];
      }
    }
  }

  const isOwner = user?.id === profile.id;

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <ProfileBackground
        backgroundUrl={profile.background_url ?? null}
        backgroundPosition={profile.background_position ?? null}
        isOwner={isOwner}
        profileId={profile.id}
        username={profile.username}
        displayName={profile.display_name || profile.username}
      />

      <div className="mx-auto max-w-7xl px-4 py-12">
        <ProfileHeader
          profile={profile}
          isOwner={isOwner}
          currentUserId={user?.id ?? null}
          isFollowing={isFollowing}
        />
        <div className="mt-12">
          <ProfileTabs
            spaces={spaces || []}
            collections={collections || []}
            profile={profile}
            likedSpaceIds={likedSpaceIds}
            savedSpaceIds={savedSpaceIds}
            currentUserId={user?.id}
          />
        </div>
      </div>
    </div>
  );
}
