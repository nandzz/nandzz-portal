"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarImageProps } from "@/lib/avatarImage";
import { Camera, Share2 } from "lucide-react";
import type { Profile, SocialLinksStyle, WidgetInstanceWithCatalog } from "@/lib/types";
import { SocialLinkButtons, buildSocialLinks, resolveSocialLinksStyle } from "./SocialLinkButtons";
import { FollowButton } from "@/features/social/components/FollowButton";
import { FollowersDialog } from "./FollowersDialog";
import { AddressMenu } from "./AddressMenu";
import { WidgetStrip } from "./WidgetStrip";
import { uploadAvatar } from "../storage";
import { updateAvatar } from "../actions/update-avatar";
import { FEATURES } from "@/lib/flags";
import { isColorDark } from "@/lib/color";
import { resolveBookingButtonStyle } from "@/lib/bookingButtonStyle";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfileStyle } from "@/contexts/ProfileStyleContext";
import { useChrome } from "@/contexts/ChromeContext";
import { ShareMenu } from "@/features/spaces/components/ShareMenu";
import {
  BANNER_OFFSET,
  CARD_OFFSET,
  HERO_MIN_HEIGHT,
  rememberHeaderLayout,
  resolveHeaderLayout,
} from "../domain/header-layout";

// Owner-only, mounted once a picture is picked: the cropper stays out of the
// page every visitor loads.
const AvatarCropModal = dynamic(() =>
  import("@/components/ui/AvatarCropModal").then((m) => m.AvatarCropModal),
);

// Guard against absurd inputs only (memory). The cropper always re-encodes to a
// 400×400 JPEG (~50 KB), so ordinary 3–10 MB phone photos must be accepted.
const MAX_AVATAR_INPUT_SIZE = 25 * 1024 * 1024;

interface ProfileHeaderProps {
  profile: Profile;
  isOwner?: boolean;
  currentUserId?: string | null;
  isFollowing?: boolean;
  widgets?: WidgetInstanceWithCatalog[];
  // Style props are fallbacks for use outside a ProfileStyleRoot; on the profile
  // page the live (owner-editable) style from context wins.
  /** Owner-chosen tint for the neutral button/pill surfaces. null = theme. */
  buttonColor?: string | null;
  /** Owner-chosen color for the header texts. null = theme. */
  textColor?: string | null;
  /** Owner-chosen layout for the social link buttons. null = icon tiles. */
  socialLinksStyle?: SocialLinksStyle | null;
}

export function ProfileHeader({ profile, isOwner, currentUserId, isFollowing = false, widgets = [], buttonColor: buttonColorProp = null, textColor: textColorProp = null, socialLinksStyle: socialLinksStyleProp = null }: ProfileHeaderProps) {
  const { t } = useLanguage();
  const live = useProfileStyle()?.style;
  const buttonColor = live ? live.buttonColor : buttonColorProp;
  const textColor = live ? live.textColor : textColorProp;
  const socialLinksStyle = live ? live.socialLinksStyle : socialLinksStyleProp;
  const bookingButtonStyle = live ? live.bookingButtonStyle : profile.booking_button_style;
  const headerLayout = resolveHeaderLayout(live ? live.headerLayout : profile.header_layout);
  // Opt-in entrance motion (globals.css: data-header-anim). Toggling it on in
  // the Style picker replays it, since the rule starts matching again.
  const anim = (live ? live.headerAnimated : !!profile.header_animated) ? { "data-header-anim": "" } : {};
  const pageColor = live?.backgroundColor ?? null;
  // Banner/card avatars sit on the cover's edge: ring them in the page color.
  const edgeRing: React.CSSProperties | undefined = pageColor ? { borderColor: pageColor } : undefined;

  // Lets the loading skeleton match this layout on the next visit.
  useEffect(() => { rememberHeaderLayout(profile.username, headerLayout); }, [profile.username, headerLayout]);
  // Hidden by default; the owner always sees their own counts.
  const showFollowCounts = isOwner || !!profile.show_follow_counts;

  // Visitors get Share in the header's action row; the owner has it in their
  // toolbar, so it only shows for them in Preview.
  const { profilePreview } = useChrome();
  const showShare = !isOwner || profilePreview;

  // Header text color. Primary elements use the full color; secondary ones
  // (handle, bio, labels) drop to 65% opacity to keep the visual hierarchy.
  const textStyle: React.CSSProperties | undefined = textColor ? { color: textColor } : undefined;
  const textMutedStyle: React.CSSProperties | undefined = textColor
    ? { color: textColor, opacity: 0.65 }
    : undefined;

  // Optimistic avatar url so upload reflects immediately, before server refresh
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(profile.avatar_url ?? null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Re-sync with server props (e.g. after router.refresh reads freshly-revalidated data).
  // Prop-sync effect, unchanged from the pre-migration implementation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocalAvatarUrl(profile.avatar_url ?? null); }, [profile.avatar_url]);

  // Object URLs (crop source + optimistic preview) must be revoked or each
  // pick leaks a full-size photo in memory.
  const previewUrlRef = useRef<string | null>(null);
  const revokePreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
  };
  useEffect(() => () => revokePreview(), []);

  const closeCropper = () => {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    setCropImageSrc(null);
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_AVATAR_INPUT_SIZE) {
      setAvatarError(t.common.error);
      return;
    }
    setAvatarError("");
    setCropImageSrc(URL.createObjectURL(file));
  };

  const handleCroppedAvatar = async (blob: Blob) => {
    closeCropper();
    const prevUrl = localAvatarUrl;
    // Show the cropped picture immediately; the upload happens behind it.
    revokePreview();
    previewUrlRef.current = URL.createObjectURL(blob);
    setLocalAvatarUrl(previewUrlRef.current);
    setAvatarUploading(true);
    setAvatarError("");
    try {
      const publicUrl = await uploadAvatar(profile.id, blob);
      // Query string busts the browser/CDN cache since the storage path is stable
      const nextUrl = `${publicUrl}?t=${Date.now()}`;

      // The action revalidates the public profile itself (the fresh server
      // render comes back with its response — no extra fetch / router.refresh).
      const result = await updateAvatar({ avatarUrl: nextUrl });
      if (!result.ok) throw new Error(result.message || "Failed to update picture");

      setLocalAvatarUrl(nextUrl);
      window.dispatchEvent(new CustomEvent("profile-updated"));
    } catch (err) {
      console.error("[profile] avatar update failed:", err);
      setLocalAvatarUrl(prevUrl);
      setAvatarError(t.common.error);
    } finally {
      // Keep the blob preview alive until the real URL has replaced it.
      setTimeout(revokePreview, 0);
      setAvatarUploading(false);
    }
  };

  const links = buildSocialLinks(profile);
  const name = profile.display_name || profile.username;

  // The widget strip (Book now CTA) moves to the owner-chosen spot in the header.
  const bookingPlacement = resolveBookingButtonStyle(bookingButtonStyle).placement;
  const widgetStrip = (className: string, align: "center" | "start" = "center") =>
    FEATURES.widgets && widgets.length > 0 ? (
      <WidgetStrip widgets={widgets} profile={profile} isAuthenticated={!!currentUserId} align={align} className={className} />
    ) : null;

  // Share is a quiet utility icon, never styled like the booking CTA. The
  // layouts park it in their own top-right corner (banner: the avatar row,
  // card: the panel, hero: the photo, centered: the header block).
  const share = (onImage = false) =>
    showShare && (
      <ShareMenu
        url={`/${profile.username}`}
        title={`${name} on Nandzz`}
        triggerClassName={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
          onImage
            ? "border-white/30 bg-white/10 text-white hover:bg-white/20"
            : "border-border/70 bg-background/60 text-foreground/75 hover:bg-background hover:text-foreground"
        }`}
        triggerContent={<Share2 className="h-4 w-4" aria-label={t.share.share} />}
      />
    );

  // Primary action row: the booking CTA when it's placed under the name.
  const actions = (className: string) => {
    const cta = bookingPlacement === "username" ? widgetStrip("", "start") : null;
    if (!cta) return null;
    return <div className={`${className} flex flex-wrap items-center gap-2`}>{cta}</div>;
  };

  // ── Shared pieces, arranged per header layout below ──────────────────────

  // `ringStyle` lets the avatar's border match whatever it overlaps (the page
  // color on the banner/card edge, white on the hero photo).
  const avatar = (sizeClass: string, px: number, fallbackClass: string, ringStyle?: React.CSSProperties) => (
    <div className="relative group shrink-0">
      <Avatar
        className={`${sizeClass} border-4 border-background shadow-xl ring-2 ring-violet-200/50 dark:ring-violet-800/30`}
        style={ringStyle}
      >
        <AvatarImage {...avatarImageProps(localAvatarUrl, px)} alt={name} />
        <AvatarFallback className={`${fallbackClass} bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300`}>
          {profile.display_name?.[0]?.toUpperCase() ||
            profile.username[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {isOwner && (
        <>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleAvatarFileChange}
          />
          <button
            type="button"
            data-owner-only
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarUploading}
            aria-label="Change profile picture"
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed"
          >
            {avatarUploading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <Camera className="h-5 w-5" />
                <span className="text-[10px] font-medium">Edit</span>
              </div>
            )}
          </button>
        </>
      )}
    </div>
  );

  const avatarExtras = (
    <>
      {avatarError && (
        <p className="mt-2 text-xs text-destructive">{avatarError}</p>
      )}

      {cropImageSrc && (
        <AvatarCropModal
          imageSrc={cropImageSrc}
          onCancel={closeCropper}
          onCrop={handleCroppedAvatar}
        />
      )}
    </>
  );

  const nameAndHandle = (h1Class: string) => (
    <>
      <h1 className={`${h1Class} text-2xl font-bold tracking-tight`} style={textStyle}>
        {name}
      </h1>
      <p className="mt-0.5 text-sm text-muted-foreground" style={textMutedStyle}>
        @{profile.username}
      </p>
    </>
  );

  const tagline = profile.tagline && (
    <p className="mt-2 text-sm font-medium text-violet-600 dark:text-violet-400" style={textStyle}>
      {profile.tagline}
    </p>
  );

  const bio = profile.bio && (
    <p className="mt-3 max-w-lg text-sm text-muted-foreground leading-relaxed break-words" style={textMutedStyle}>
      {profile.bio}
    </p>
  );

  const address = profile.address?.formatted && (
    <AddressMenu
      address={profile.address}
      shareTitle={name}
      style={textMutedStyle}
    />
  );

  // Nothing to show for most visitors (counts are opt-in): skip the row so it
  // doesn't leave an empty gap above the links.
  const showCountsRow = showFollowCounts || (!isOwner && !!currentUserId && !!profile.show_follow_counts);
  const counts = showCountsRow && (
    <div className="mt-4 flex items-center gap-5">
      {showFollowCounts && (
        <>
          <FollowersDialog profileId={profile.id} type="followers" count={profile.followers_count ?? 0}>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-semibold" style={textStyle}>{profile.followers_count ?? 0}</span>
              <span className="text-muted-foreground" style={textMutedStyle}>{(profile.followers_count ?? 0) === 1 ? t.profile.follower : t.profile.followers}</span>
            </div>
          </FollowersDialog>
          <FollowersDialog profileId={profile.id} type="following" count={profile.following_count ?? 0}>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-semibold" style={textStyle}>{profile.following_count ?? 0}</span>
              <span className="text-muted-foreground" style={textMutedStyle}>{t.profile.following}</span>
            </div>
          </FollowersDialog>
        </>
      )}
      {/* Following is opt-in: the button only appears when the owner turned
          on Settings → follow counts. */}
      {!isOwner && currentUserId && profile.show_follow_counts && (
        <FollowButton profileId={profile.id} initialIsFollowing={isFollowing} />
      )}
    </div>
  );

  const socialLinks = (align: "center" | "start") =>
    links.length > 0 && (
      <SocialLinkButtons
        links={links}
        style={socialLinksStyle}
        buttonColor={buttonColor}
        align={align}
        className={resolveSocialLinksStyle(socialLinksStyle).layout === "stack" ? "mt-6" : "mt-5"}
      />
    );

  // Bio → address → counts → links, with the CTA in its chosen slot. Shared by
  // every layout; hero renders the identity part on the cover instead.
  const details = (align: "center" | "start") => (
    <>
      {bio}
      {bookingPlacement === "description" && widgetStrip("mt-4", align)}
      {address}
      {counts}
      {socialLinks(align)}
      {bookingPlacement === "social" && widgetStrip("mt-5", align)}
    </>
  );

  // ── Banner: short cover strip, avatar on its edge, everything left-aligned.
  if (headerLayout === "banner") {
    return (
      <div className={`flex flex-col items-start text-left ${BANNER_OFFSET}`} {...anim}>
        <div className="relative flex w-full items-end justify-between gap-3">
          {/* Cover edge = the avatar's vertical centre. */}
          <span data-cover-edge aria-hidden className="pointer-events-none absolute top-12 md:top-14" />
          {avatar("h-24 w-24 md:h-28 md:w-28", 112, "text-3xl", edgeRing)}
          <div className="mb-1">{share()}</div>
        </div>
        {avatarExtras}
        {nameAndHandle("mt-3")}
        {/* Actions under the name (LinkedIn-style): beside the avatar they
            drifted to the far edge of the wide page. */}
        {actions("mt-4")}
        {tagline}
        {details("start")}
      </div>
    );
  }

  // ── Card: the identity sits on a panel floating over the cover's edge.
  if (headerLayout === "card") {
    return (
      <div
        className={`relative mx-auto max-w-2xl rounded-3xl border border-border/50 bg-background px-5 pb-7 shadow-xl sm:px-8 ${CARD_OFFSET}`}
        // On a custom page color, lift the panel a step off the page (lighter
        // on dark pages, darker on light ones) so it still reads as a card.
        style={pageColor ? { backgroundColor: `color-mix(in srgb, ${pageColor} 93%, ${isColorDark(pageColor) ? "#ffffff" : "#000000"})` } : undefined}
      >
        {/* Cover edge: the panel overlaps the cover's bottom 3.5rem. */}
        <span data-cover-edge aria-hidden className="pointer-events-none absolute top-14" />
        {showShare && <div className="absolute right-3 top-3 sm:right-4 sm:top-4">{share()}</div>}
        <div className="flex flex-col items-center text-center" {...anim}>
          <div className="-mt-12 md:-mt-14">
            {avatar("h-24 w-24 md:h-28 md:w-28", 112, "text-3xl", edgeRing)}
          </div>
          {avatarExtras}
          {nameAndHandle("mt-4")}
          {actions("mt-4 justify-center")}
          {tagline}
          {details("center")}
        </div>
      </div>
    );
  }

  // ── Hero: big photo, identity overlaid on its darkened bottom edge (always
  // white text — the cover, or its dark fallback, is behind it).
  if (headerLayout === "hero") {
    return (
      <>
        <div className={`relative flex flex-col justify-end pb-6 text-left ${HERO_MIN_HEIGHT}`} {...anim}>
          {/* Cover edge: the bottom of the identity block. */}
          <span data-cover-edge aria-hidden className="pointer-events-none absolute bottom-0" />
          {showShare && <div className="absolute right-0 top-0">{share(true)}</div>}
          <div className="flex items-end gap-4">
            {avatar("h-20 w-20 md:h-24 md:w-24", 96, "text-2xl", { borderColor: "rgb(255 255 255 / 0.85)" })}
            <div className="min-w-0 pb-1">
              <h1 className="truncate text-2xl font-bold tracking-tight text-white drop-shadow-sm md:text-3xl">
                {name}
              </h1>
              <p className="mt-0.5 truncate text-sm text-white/80">@{profile.username}</p>
            </div>
          </div>
          {avatarExtras}
          {profile.tagline && (
            <p className="mt-3 max-w-xl text-sm font-medium text-white/90">{profile.tagline}</p>
          )}
          {actions("mt-4")}
        </div>
        <div className="flex flex-col items-start text-left" {...anim}>
          {details("start")}
        </div>
      </>
    );
  }

  // ── Centered (default): avatar, info and links stacked in the middle.
  return (
    <div className="relative flex flex-col items-center text-center" {...anim}>
      {showShare && <div className="absolute right-0 top-0">{share()}</div>}
      {avatar("h-28 w-28", 112, "text-3xl")}
      {avatarExtras}
      {nameAndHandle("mt-5")}
      {actions("mt-4 justify-center")}
      {tagline}
      {details("center")}
    </div>
  );
}
