import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileHeader, ProfileBackground, ProfileStyleRoot } from "@/features/profile";
import { getPublicProfile, redirectToCanonicalUsername } from "@/features/profile/server";
import { profileStyleFromRow, safeHex } from "@/features/profile/domain/style";
import { ProfileViewTracker } from "@/features/analytics";
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
import { ReportLink } from "@/features/legal/components/ReportLink";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const [profile, t] = await Promise.all([getPublicProfile(username), getServerTranslations()]);

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

// Edge-to-edge on phones (Linktree-style): `viewport-fit=cover` lets the cover
// photo draw under the status bar / Safari toolbars instead of stopping at the
// safe area, and the browser chrome is tinted with the profile's own color.
// Content clears the notch via env(safe-area-inset-*) paddings.
export async function generateViewport({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Viewport> {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  const bg = safeHex(profile?.background_color);
  return {
    viewportFit: "cover",
    ...(bg && { themeColor: bg }),
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
  redirectToCanonicalUsername(username);

  const profile = await getPublicProfile(username);

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
          .order("id", { ascending: false })
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
          .order("id", { ascending: false })
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
          .order("id", { ascending: false })
          .range(0, PROFILE_PREVIEW_SIZE - 1)
      : Promise.resolve(emptyResult),
    supabase.auth.getUser(),
    FEATURES.widgets
      ? getProfileWidgets(profile.id)
      : Promise.resolve([] as WidgetInstanceWithCatalog[]),
  ]);

  let likedSpaceIds: string[] = [];
  let savedSpaceIds: string[] = [];
  let isFollowing = false;

  if (user) {
    const allSpaceIds = [...(spaces ?? []), ...(galleryImages ?? [])].map(s => s.id);
    const hasSpaces = allSpaceIds.length > 0;
    [isFollowing, likedSpaceIds, savedSpaceIds] = await Promise.all([
      user.id !== profile.id
        ? getIsFollowing(supabase, user.id, profile.id)
        : Promise.resolve(false),
      hasSpaces ? getLikedSpaceIds(supabase, user.id, allSpaceIds) : Promise.resolve([]),
      hasSpaces ? getSavedSpaceIds(supabase, user.id, allSpaceIds) : Promise.resolve([]),
    ]);
  }

  const isOwner = user?.id === profile.id;
  const hasContents = (spaces?.length ?? 0) > 0;
  const hasLinks = (linkSpaces?.length ?? 0) > 0;
  const hasGallery = (galleryImages?.length ?? 0) > 0;

  // Live, owner-editable style. A custom background color locks the profile to
  // a light/dark theme derived from that color's brightness (ProfileStyleRoot
  // computes it identically on the server render → no flash, and live while the
  // owner edits).
  const initialStyle = profileStyleFromRow(profile);

  // Logged-in users get a sticky top Navbar here (mobile only; the Sidebar
  // takes over at md+). Pull the whole profile up behind it (h-16) and add back
  // matching top padding, so the cover photo extends under the bar and its
  // translucent/blur reads at rest (iOS-style) instead of solid white. Reset at
  // md+ where there's no top bar. Logged-out visitors get no Navbar (clean
  // branded page), so no pull-up — their floating-pill clearance lives in <main>.
  // The navbar grows by the status-bar inset (viewport-fit=cover), so the
  // pull-up does too. Logged-out visitors have no bar: just clear the notch.
  const coverUnderNav = user
    ? "-mt-[calc(4rem+env(safe-area-inset-top))] pt-[calc(4rem+env(safe-area-inset-top))] md:mt-0 md:pt-0"
    : "pt-[env(safe-area-inset-top)]";

  return (
    <ProfileStyleRoot
      initial={initialStyle}
      isOwner={isOwner}
      className={`relative min-h-[calc(100vh-8rem)] ${coverUnderNav}`}
    >
      {!isOwner && <ProfileViewTracker profileId={profile.id} />}
      <ProfileBackground
        backgroundUrl={profile.background_url ?? null}
        backgroundPosition={profile.background_position ?? null}
        hasBookingWidget={widgets.some((w) => w.catalog.slug === "calendar")}
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
        {!isOwner && (
          <div className="mt-16 flex justify-center">
            <ReportLink path={`/${profile.username}`} />
          </div>
        )}
      </PageShell>
    </ProfileStyleRoot>
  );
}
