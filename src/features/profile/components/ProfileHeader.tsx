"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera } from "lucide-react";
import type { Profile, SocialLinksStyle, WidgetInstanceWithCatalog } from "@/lib/types";
import { SocialLinkButtons, buildSocialLinks, resolveSocialLinksStyle } from "./SocialLinkButtons";
import { FollowButton } from "@/features/social";
import { FollowersDialog } from "./FollowersDialog";
import { AddressMenu } from "./AddressMenu";
import { WidgetStrip } from "./WidgetStrip";
import { AvatarCropModal } from "@/components/ui/AvatarCropModal";
import { uploadAvatar } from "../storage";
import { updateAvatar } from "../actions/update-avatar";
import { FEATURES } from "@/lib/flags";
import { isColorDark } from "@/lib/color";
import { resolveBookingButtonStyle } from "@/lib/bookingButtonStyle";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfileStyle } from "@/contexts/ProfileStyleContext";

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
  // Hidden by default; the owner always sees their own counts.
  const showFollowCounts = isOwner || !!profile.show_follow_counts;

  // When the owner tints the buttons, override the surface + a readable text
  // color inline (inline wins over the theme `bg-background` / hover classes).
  const buttonStyle: React.CSSProperties | undefined = buttonColor
    ? { backgroundColor: buttonColor, color: isColorDark(buttonColor) ? "#ffffff" : "#111827", borderColor: "transparent" }
    : undefined;

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

  // The widget strip (Book now CTA) moves to the owner-chosen spot in the header.
  const bookingPlacement = resolveBookingButtonStyle(bookingButtonStyle).placement;
  const widgetStrip = (className: string) =>
    FEATURES.widgets && widgets.length > 0 ? (
      <WidgetStrip widgets={widgets} profile={profile} isAuthenticated={!!currentUserId} className={className} />
    ) : null;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative group">
        <Avatar className="h-28 w-28 border-4 border-background shadow-xl ring-2 ring-violet-200/50 dark:ring-violet-800/30">
          <AvatarImage src={localAvatarUrl || undefined} alt={profile.display_name || profile.username} />
          <AvatarFallback className="text-3xl bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
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
      <h1 className="mt-5 text-2xl font-bold tracking-tight" style={textStyle}>
        {profile.display_name || profile.username}
      </h1>
      <p className="mt-0.5 text-sm text-muted-foreground" style={textMutedStyle}>
        @{profile.username}
      </p>
      {bookingPlacement === "username" && widgetStrip("mt-4")}
      {profile.tagline && (
        <p className="mt-2 text-sm font-medium text-violet-600 dark:text-violet-400" style={textStyle}>
          {profile.tagline}
        </p>
      )}
      {profile.bio && (
        <p className="mt-3 max-w-lg text-sm text-muted-foreground leading-relaxed break-words" style={textMutedStyle}>
          {profile.bio}
        </p>
      )}
      {bookingPlacement === "description" && widgetStrip("mt-4")}

      {profile.address?.formatted && (
        <AddressMenu
          address={profile.address}
          shareTitle={profile.display_name || profile.username}
          style={buttonStyle}
        />
      )}

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
        {!isOwner && currentUserId && (
          <FollowButton profileId={profile.id} initialIsFollowing={isFollowing} />
        )}
      </div>

      {links.length > 0 && (
        <SocialLinkButtons
          links={links}
          style={socialLinksStyle}
          buttonColor={buttonColor}
          className={resolveSocialLinksStyle(socialLinksStyle).layout === "stack" ? "mt-6" : "mt-5"}
        />
      )}

      {bookingPlacement === "social" && widgetStrip("mt-5")}
    </div>
  );
}
