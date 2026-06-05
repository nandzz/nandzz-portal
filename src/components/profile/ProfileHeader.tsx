import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Camera,
  Briefcase,
  X,
  GitBranch,
  Mail,
  Play,
  Globe,
} from "lucide-react";
import type { Profile } from "@/lib/types";
import { FollowButton } from "./FollowButton";
import { FollowersDialog } from "./FollowersDialog";
import { AgentEmbed } from "@/components/agent/AgentEmbed";
import { FEATURES } from "@/lib/flags";

interface ProfileHeaderProps {
  profile: Profile;
  isOwner?: boolean;
  currentUserId?: string | null;
  isFollowing?: boolean;
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

export function ProfileHeader({ profile, isOwner, currentUserId, isFollowing = false }: ProfileHeaderProps) {
  const socialLinks = profile.social_links || {};

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
      icon: Camera,
      label: "Instagram",
      hoverClass: "hover:text-pink-500",
    },
    {
      key: "linkedin",
      value: socialLinks.linkedin,
      icon: Briefcase,
      label: "LinkedIn",
      hoverClass: "hover:text-blue-600",
    },
    {
      key: "twitter",
      value: socialLinks.twitter,
      icon: X,
      label: "X (Twitter)",
      hoverClass: "hover:text-foreground",
    },
    {
      key: "github",
      value: socialLinks.github,
      icon: GitBranch,
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
      icon: Play,
      label: "YouTube",
      hoverClass: "hover:text-red-600",
    },
  ].filter((link) => link.value && link.value.trim() !== "");

  return (
    <div className="flex flex-col items-center text-center">
      <Avatar className="h-28 w-28 border-4 border-background shadow-xl ring-2 ring-violet-200/50 dark:ring-violet-800/30">
        <AvatarImage src={profile.avatar_url || undefined} />
        <AvatarFallback className="text-3xl bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
          {profile.display_name?.[0]?.toUpperCase() ||
            profile.username[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">
        {profile.display_name || profile.username}
      </h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        @{profile.username}
      </p>
      {profile.tagline && (
        <p className="mt-2 text-sm font-medium text-violet-600 dark:text-violet-400">
          {profile.tagline}
        </p>
      )}
      {profile.bio && (
        <p className="mt-3 max-w-lg text-sm text-muted-foreground leading-relaxed">
          {profile.bio}
        </p>
      )}

      <div className="mt-4 flex items-center gap-5">
        <FollowersDialog profileId={profile.id} type="followers" count={profile.followers_count ?? 0}>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-semibold">{profile.followers_count ?? 0}</span>
            <span className="text-muted-foreground">followers</span>
          </div>
        </FollowersDialog>
        <FollowersDialog profileId={profile.id} type="following" count={profile.following_count ?? 0}>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-semibold">{profile.following_count ?? 0}</span>
            <span className="text-muted-foreground">following</span>
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
                className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background text-muted-foreground transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 ${link.hoverClass}`}
              >
                <Icon className="h-4 w-4" />
              </a>
            );
          })}
        </div>
      )}

      {FEATURES.agent && <AgentEmbed profile={profile} isAuthenticated={!!currentUserId} />}
    </div>
  );
}
