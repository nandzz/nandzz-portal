"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Mail, Globe } from "lucide-react";
import {
  InstagramIcon,
  LinkedinIcon,
  XIcon,
  GithubIcon,
  YoutubeIcon,
} from "./BrandIcons";
import type { Profile, WidgetInstanceWithCatalog } from "@/lib/types";
import { FollowButton } from "@/features/social";
import { FollowersDialog } from "./FollowersDialog";
import { AddressMenu } from "./AddressMenu";
import { WidgetStrip } from "@/features/booking";
import { AvatarCropModal } from "@/components/ui/AvatarCropModal";
import { uploadAvatar } from "../storage";
import { updateAvatar } from "../actions/update-avatar";
import { FEATURES } from "@/lib/flags";
import { isColorDark } from "@/lib/color";
import { useLanguage } from "@/contexts/LanguageContext";

const MAX_AVATAR_SIZE = 1.5 * 1024 * 1024;

interface ProfileHeaderProps {
  profile: Profile;
  isOwner?: boolean;
  currentUserId?: string | null;
  isFollowing?: boolean;
  widgets?: WidgetInstanceWithCatalog[];
  /** Owner-chosen tint for the neutral button/pill surfaces. null = theme. */
  buttonColor?: string | null;
  /** Owner-chosen color for the header texts. null = theme. */
  textColor?: string | null;
}

function buildUrl(key: string, value: string): string {
  const v = value.trim();
  if (key === "email") return `mailto:${v}`;
  if (key === "website") return v.startsWith("http") ? v : `https://${v}`;
  const baseUrls: Record<string, string> = {
    instagram: "https://instagram.com/",
    linkedin: "https://linkedin.com/in/",
    twitter: "https://x.com/",
    github: "https://github.com/",
    youtube: "https://youtube.com/@",
  };
  // If user pasted a full URL, use it as-is
  if (v.startsWith("http")) return v;
  // Otherwise prepend the base URL to the handle
  return `${baseUrls[key]}${v.replace(/^@/, "")}`;
}

export function ProfileHeader({ profile, isOwner, currentUserId, isFollowing = false, widgets = [], buttonColor = null, textColor = null }: ProfileHeaderProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const socialLinks = profile.social_links || {};

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

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError("Profile picture must be under 1.5 MB");
      e.target.value = "";
      return;
    }
    setAvatarError("");
    const reader = new FileReader();
    reader.onload = () => setCropImageSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCroppedAvatar = async (blob: Blob) => {
    setCropImageSrc(null);
    setAvatarUploading(true);
    setAvatarError("");
    try {
      const publicUrl = await uploadAvatar(profile.id, blob);
      // Query string busts the browser/CDN cache since the storage path is stable
      const nextUrl = `${publicUrl}?t=${Date.now()}`;

      const result = await updateAvatar({ avatarUrl: nextUrl });
      if (!result.ok) throw new Error(result.message || "Failed to update picture");

      setLocalAvatarUrl(nextUrl);
      // Invalidate the profile page's unstable_cache tag so router.refresh reads fresh data
      await fetch("/api/profile/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: profile.username }),
      });
      window.dispatchEvent(new CustomEvent("profile-updated"));
      router.refresh();
    } catch (err) {
      console.error("[profile] avatar update failed:", err);
      setAvatarError(t.common.error);
    } finally {
      setAvatarUploading(false);
    }
  };

  const links = [
    {
      key: "website",
      value: profile.website_url,
      icon: Globe,
      label: "Website",
      hoverClass: "hover:text-violet-600 dark:hover:text-violet-400",
    },
    {
      key: "instagram",
      value: socialLinks.instagram,
      icon: InstagramIcon,
      label: "Instagram",
      hoverClass: "hover:text-pink-500",
    },
    {
      key: "linkedin",
      value: socialLinks.linkedin,
      icon: LinkedinIcon,
      label: "LinkedIn",
      hoverClass: "hover:text-blue-600",
    },
    {
      key: "twitter",
      value: socialLinks.twitter,
      icon: XIcon,
      label: "X (Twitter)",
      hoverClass: "hover:text-foreground",
    },
    {
      key: "github",
      value: socialLinks.github,
      icon: GithubIcon,
      label: "GitHub",
      hoverClass: "hover:text-foreground",
    },
    {
      key: "email",
      value: socialLinks.email,
      icon: Mail,
      label: "Email",
      hoverClass: "hover:text-foreground",
    },
    {
      key: "youtube",
      value: socialLinks.youtube,
      icon: YoutubeIcon,
      label: "YouTube",
      hoverClass: "hover:text-red-600",
    },
  ].filter((link) => link.value && link.value.trim() !== "");

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
          onCancel={() => setCropImageSrc(null)}
          onCrop={handleCroppedAvatar}
        />
      )}
      <h1 className="mt-5 text-2xl font-bold tracking-tight" style={textStyle}>
        {profile.display_name || profile.username}
      </h1>
      <p className="mt-0.5 text-sm text-muted-foreground" style={textMutedStyle}>
        @{profile.username}
      </p>
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

      {profile.address?.formatted && (
        <AddressMenu
          address={profile.address}
          shareTitle={profile.display_name || profile.username}
          style={buttonStyle}
        />
      )}

      <div className="mt-4 flex items-center gap-5">
        <FollowersDialog profileId={profile.id} type="followers" count={profile.followers_count ?? 0}>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-semibold" style={textStyle}>{profile.followers_count ?? 0}</span>
            <span className="text-muted-foreground" style={textMutedStyle}>{t.profile.followers}</span>
          </div>
        </FollowersDialog>
        <FollowersDialog profileId={profile.id} type="following" count={profile.following_count ?? 0}>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-semibold" style={textStyle}>{profile.following_count ?? 0}</span>
            <span className="text-muted-foreground" style={textMutedStyle}>{t.profile.following}</span>
          </div>
        </FollowersDialog>
        {!isOwner && currentUserId && (
          <FollowButton profileId={profile.id} initialIsFollowing={isFollowing} />
        )}
      </div>

      {links.length > 0 && (
        <div className="mt-5 flex items-center gap-2">
          {links.map((link) => {
            const Icon = link.icon;
            const href = buildUrl(link.key, link.value!);
            return (
              <a
                key={link.key}
                href={href}
                aria-label={link.label}
                target={link.key === "email" ? undefined : "_blank"}
                rel={
                  link.key === "email" ? undefined : "noopener noreferrer"
                }
                style={buttonStyle}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background text-muted-foreground transition-[color,box-shadow,transform] duration-200 hover:shadow-sm motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${link.hoverClass}`}
              >
                <Icon className="h-4 w-4" />
              </a>
            );
          })}
        </div>
      )}

      {FEATURES.widgets && widgets.length > 0 && (
        <WidgetStrip widgets={widgets} profile={profile} isAuthenticated={!!currentUserId} />
      )}
    </div>
  );
}
