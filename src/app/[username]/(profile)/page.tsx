import type { Metadata } from "next";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfileHeader, ProfileBackground } from "@/features/profile";
import { ProfileContent } from "@/components/profile/ProfileContent";
import { ProfileLinks } from "@/components/profile/ProfileLinks";
import { ProfileGallery } from "@/components/profile/ProfileGallery";
import { ProfileSections } from "@/components/profile/ProfileSections";
import {
  resolveGalleryLayout,
  resolveContentsLayout,
  resolveLinksLayout,
  resolveSectionOrder,
} from "@/lib/gallery/layouts";
import { FEATURES } from "@/lib/flags";
import { getProfileWidgets } from "@/features/booking/server";
import type { WidgetInstanceWithCatalog, Space } from "@/lib/types";
import { getServerTranslations } from "@/lib/i18n/server";
import { getIsFollowing, getLikedSpaceIds } from "@/features/social/server";
import { getSavedSpaceIds } from "@/features/collections/server";
import { PageShell } from "@/components/layout/PageShell";
import { isColorDark } from "@/lib/color";

const fetchProfileByUsername = async (username: string) => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();
  return data;
};

// Per-username tag so a single profile can be invalidated with revalidateTag(`profile:${username}`)
const getProfile = cache((username: string) =>
  unstable_cache(
    () => fetchProfileByUsername(username),
    ["profile", username],
    { revalidate: 60, tags: [`profile:${username}`] }
  )()
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const [profile, t] = await Promise.all([getProfile(username), getServerTranslations()]);

  if (!profile) {
    return { title: t.meta.profileNotFoundTitle };
  }

  const name = profile.display_name || profile.username;

  const description = profile.tagline || t.meta.profileDescriptionFallback.replace("{name}", name);

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
        images: [{ url: profile.avatar_url, alt: t.meta.profileAvatarAlt.replace("{name}", name) }],
      }),
    },
    twitter: {
      card: "summary",
      title: `${name} (@${profile.username}) | Nandzz`,
      description,
      ...(profile.avatar_url && { images: [profile.avatar_url] }),
    },
  };
}

// Every profile section shows at most 12 items inline; the rest are reached via
// each section's "see more" (a route for Publications/Links, a modal for the
// gallery).
const PROFILE_PREVIEW_SIZE = 12;

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

  // Owner-controlled public visibility (managed from the contents dashboard).
  // Each section is now its own carousel: `show_contents` gates Publications
  // (informative content), `show_links` gates Links, `show_gallery` the gallery.
  const showContents = profile.show_contents ?? true;
  const showLinks = profile.show_links ?? true;
  const showGallery = profile.show_gallery ?? true;

  const emptyResult = { data: [] as Space[], count: 0 };

  const [
    { data: spaces, count: totalSpaceCount },
    { data: linkSpaces, count: totalLinkCount },
    { data: galleryImages, count: totalGalleryCount },
    { data: { user } },
    widgets,
  ] = await Promise.all([
    // Publications: informative content only (everything non-image, non-link).
    showContents
      ? supabase
          .from("spaces")
          .select("*", { count: "exact" })
          .eq("user_id", profile.id)
          .eq("is_public", true)
          .neq("content_type", "image")
          .neq("content_type", "link")
          .neq("content_type", "video")
          .order("created_at", { ascending: false })
          .range(0, PROFILE_PREVIEW_SIZE - 1)
      : Promise.resolve(emptyResult),
    // Links: link/video-type spaces, rendered as favicon chips.
    showLinks
      ? supabase
          .from("spaces")
          .select("*", { count: "exact" })
          .eq("user_id", profile.id)
          .eq("is_public", true)
          .in("content_type", ["link", "video"])
          .order("created_at", { ascending: false })
          .range(0, PROFILE_PREVIEW_SIZE - 1)
      : Promise.resolve(emptyResult),
    // Gallery: image-type spaces only.
    showGallery
      ? supabase
          .from("spaces")
          .select("*", { count: "exact" })
          .eq("user_id", profile.id)
          .eq("is_public", true)
          .eq("content_type", "image")
          .order("created_at", { ascending: false })
          .range(0, PROFILE_PREVIEW_SIZE - 1)
      : Promise.resolve(emptyResult),
    supabase.auth.getUser(),
    FEATURES.widgets
      ? getProfileWidgets(profile.id)
      : Promise.resolve([] as WidgetInstanceWithCatalog[]),
  ]);

  const t = await getServerTranslations();

  let likedSpaceIds: string[] = [];
  let savedSpaceIds: string[] = [];
  let isFollowing = false;

  if (user) {
    const allSpaceIds = [...(spaces ?? []), ...(galleryImages ?? [])].map(s => s.id);

    if (user.id !== profile.id) {
      isFollowing = await getIsFollowing(supabase, user.id, profile.id);
    }

    if (allSpaceIds.length > 0) {
      const [likes, saved] = await Promise.all([
        getLikedSpaceIds(supabase, user.id, allSpaceIds),
        getSavedSpaceIds(supabase, user.id, allSpaceIds),
      ]);
      likedSpaceIds = likes;
      savedSpaceIds = saved;
    }
  }

  const isOwner = user?.id === profile.id;
  const hasContents = (spaces?.length ?? 0) > 0;
  const hasLinks = (linkSpaces?.length ?? 0) > 0;
  const hasGallery = (galleryImages?.length ?? 0) > 0;

  // A custom background color locks the profile to a light/dark theme derived
  // from that color's brightness, so all chrome + text stay legible regardless
  // of the visitor's device theme. Computed server-side → no flash.
  const bgColor = profile.background_color ?? null;
  const profileTheme = bgColor ? (isColorDark(bgColor) ? "dark" : "light") : "";

  // Logged-in users get a sticky top Navbar here (mobile only; the Sidebar
  // takes over at md+). Pull the whole profile up behind it (h-16) and add back
  // matching top padding, so the cover photo extends under the bar and its
  // translucent/blur reads at rest (iOS-style) instead of solid white. Reset at
  // md+ where there's no top bar. Logged-out visitors get no Navbar (clean
  // branded page), so no pull-up — their floating-pill clearance lives in <main>.
  const coverUnderNav = user ? "-mt-16 pt-16 md:mt-0 md:pt-0" : "";

  return (
    <div className={`relative min-h-[calc(100vh-8rem)] ${coverUnderNav} ${profileTheme}`}>
      <ProfileBackground
        backgroundUrl={profile.background_url ?? null}
        backgroundPosition={profile.background_position ?? null}
        backgroundColor={bgColor}
        buttonColor={profile.button_color ?? null}
        textColor={profile.text_color ?? null}
        isOwner={isOwner}
        profileId={profile.id}
        username={profile.username}
        displayName={profile.display_name || profile.username}
        profile={profile}
      />

      <PageShell width="wide">
        <ProfileHeader
          profile={profile}
          isOwner={isOwner}
          currentUserId={user?.id ?? null}
          isFollowing={isFollowing}
          widgets={widgets}
          buttonColor={profile.button_color ?? null}
          textColor={profile.text_color ?? null}
        />
        <ProfileSections
          order={resolveSectionOrder(profile)}
          isOwner={isOwner}
          profileId={profile.id}
          username={profile.username}
          sections={{
            gallery: hasGallery ? (
              <ProfileGallery
                images={galleryImages || []}
                totalCount={totalGalleryCount ?? galleryImages?.length ?? 0}
                profile={profile}
                isOwner={isOwner}
                initialLayout={resolveGalleryLayout(profile)}
                enableModal
              />
            ) : null,
            publications: hasContents ? (
              <ProfileContent
                spaces={spaces || []}
                totalCount={totalSpaceCount ?? spaces?.length ?? 0}
                profile={profile}
                isOwner={isOwner}
                initialLayout={resolveContentsLayout(profile)}
                likedSpaceIds={likedSpaceIds}
                savedSpaceIds={savedSpaceIds}
                currentUserId={user?.id}
              />
            ) : null,
            links: hasLinks ? (
              <ProfileLinks
                links={linkSpaces || []}
                totalCount={totalLinkCount ?? linkSpaces?.length ?? 0}
                profile={profile}
                isOwner={isOwner}
                initialLayout={resolveLinksLayout(profile)}
              />
            ) : null,
          }}
        />
        {!hasGallery && !hasContents && !hasLinks && (
          <p className="mt-12 py-12 text-center text-muted-foreground">
            {t.profile.noPublicSpaces}
          </p>
        )}
      </PageShell>
    </div>
  );
}
