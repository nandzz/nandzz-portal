import type { ComponentType, CSSProperties, SVGProps } from "react";
import { ArrowUpRight, Globe, Mail } from "lucide-react";
import {
  InstagramIcon,
  LinkedinIcon,
  XIcon,
  GithubIcon,
  YoutubeIcon,
} from "./BrandIcons";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import type { Profile, SocialLinksStyle } from "@/lib/types";
import { isColorDark } from "@/lib/color";

// Shared by the profile header and the Style picker's live preview so the two
// can never drift.

export type ResolvedSocialLinksStyle = Required<SocialLinksStyle>;

export const DEFAULT_SOCIAL_LINKS_STYLE: ResolvedSocialLinksStyle = {
  layout: "icons",
  shape: "rounded",
  size: "md",
  tone: "default",
};

export function resolveSocialLinksStyle(
  s: SocialLinksStyle | null | undefined,
): ResolvedSocialLinksStyle {
  return { ...DEFAULT_SOCIAL_LINKS_STYLE, ...(s ?? {}) };
}

export type SocialLink = {
  key: string;
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Hover accent for the neutral tone. */
  hoverClass: string;
  /** Brand glyph color; null = monochrome brand (inherits the text color). */
  brandColor: string | null;
  /** Brand tile fill (color or gradient) for the filled tone. */
  brandFill: string;
};

type LinkDef = Omit<SocialLink, "href"> & { value: string | null | undefined };

function buildUrl(key: string, value: string): string {
  const v = value.trim();
  if (key === "email") return `mailto:${v}`;
  if (key === "whatsapp") return `https://wa.me/${v.replace(/\D/g, "")}`;
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

export const INSTAGRAM_FILL =
  "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285aeb 90%)";

export function buildSocialLinks(
  profile: Pick<Profile, "website_url" | "social_links">,
): SocialLink[] {
  const s = profile.social_links || {};
  const defs: LinkDef[] = [
    { key: "website", value: profile.website_url, icon: Globe, label: "Website", hoverClass: "hover:text-violet-600 dark:hover:text-violet-400", brandColor: "#7c3aed", brandFill: "#7c3aed" },
    { key: "instagram", value: s.instagram, icon: InstagramIcon, label: "Instagram", hoverClass: "hover:text-pink-500", brandColor: "#e4405f", brandFill: INSTAGRAM_FILL },
    { key: "linkedin", value: s.linkedin, icon: LinkedinIcon, label: "LinkedIn", hoverClass: "hover:text-blue-600", brandColor: "#0a66c2", brandFill: "#0a66c2" },
    { key: "twitter", value: s.twitter, icon: XIcon, label: "X", hoverClass: "hover:text-foreground", brandColor: null, brandFill: "#000000" },
    { key: "github", value: s.github, icon: GithubIcon, label: "GitHub", hoverClass: "hover:text-foreground", brandColor: null, brandFill: "#181717" },
    { key: "email", value: s.email, icon: Mail, label: "Email", hoverClass: "hover:text-foreground", brandColor: null, brandFill: "#475569" },
    { key: "youtube", value: s.youtube, icon: YoutubeIcon, label: "YouTube", hoverClass: "hover:text-red-600", brandColor: "#ff0000", brandFill: "#ff0000" },
    { key: "whatsapp", value: s.whatsapp, icon: WhatsAppIcon, label: "WhatsApp", hoverClass: "hover:text-green-600", brandColor: "#25d366", brandFill: "#25d366" },
  ];
  return defs
    .filter((d) => d.value && d.value.trim() !== "")
    .map(({ value, ...d }) => ({ ...d, href: buildUrl(d.key, value!) }));
}

const SHAPE_CLASS = {
  md: { pill: "rounded-full", rounded: "rounded-lg", square: "rounded-[5px]" },
  lg: { pill: "rounded-full", rounded: "rounded-xl", square: "rounded-md" },
} as const;

const CONTAINER_CLASS = {
  icons: { md: "flex flex-wrap items-center justify-center gap-2", lg: "flex flex-wrap items-center justify-center gap-3" },
  chips: { md: "flex flex-wrap items-center justify-center gap-2", lg: "flex flex-wrap items-center justify-center gap-2.5" },
  stack: { md: "flex w-full max-w-sm flex-col gap-2.5", lg: "flex w-full max-w-md flex-col gap-3" },
  minimal: { md: "flex flex-wrap items-center justify-center gap-4", lg: "flex flex-wrap items-center justify-center gap-5" },
} as const;

const ITEM_CLASS = {
  icons: { md: "h-9 w-9 justify-center", lg: "h-12 w-12 justify-center" },
  chips: { md: "h-9 gap-2 px-3.5 text-sm font-medium", lg: "h-11 gap-2.5 px-5 text-[15px] font-medium" },
  stack: { md: "relative h-12 w-full justify-center px-12 text-sm font-medium", lg: "relative h-14 w-full justify-center px-14 text-base font-medium" },
  minimal: { md: "p-1", lg: "p-1" },
} as const;

const ICON_CLASS = {
  icons: { md: "h-4 w-4", lg: "h-5 w-5" },
  chips: { md: "h-4 w-4", lg: "h-[18px] w-[18px]" },
  stack: { md: "absolute left-4 h-[18px] w-[18px]", lg: "absolute left-5 h-5 w-5" },
  minimal: { md: "h-5 w-5", lg: "h-6 w-6" },
} as const;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2";

function presentLink(
  link: SocialLink,
  r: ResolvedSocialLinksStyle,
  buttonColor: string | null,
): { className: string; style: CSSProperties | undefined; iconStyle: CSSProperties | undefined } {
  const base = `group flex items-center transition-[color,background-color,box-shadow,transform,filter] duration-200 motion-safe:hover:-translate-y-0.5 ${FOCUS} ${ITEM_CLASS[r.layout][r.size]}`;
  const brandIcon = link.brandColor ? { color: link.brandColor } : undefined;

  // Minimal = bare glyphs, no surface. The button color tints the glyphs.
  if (r.layout === "minimal") {
    if (r.tone !== "default") {
      return { className: `${base} rounded-md text-foreground hover:opacity-80`, style: undefined, iconStyle: brandIcon };
    }
    return {
      className: `${base} rounded-md text-muted-foreground ${buttonColor ? "hover:opacity-80" : link.hoverClass}`,
      style: buttonColor ? { color: buttonColor } : undefined,
      iconStyle: undefined,
    };
  }

  const shaped = `${base} border ${SHAPE_CLASS[r.size][r.shape]} hover:shadow-md`;

  if (r.tone === "filled") {
    return {
      className: `${shaped} border-white/10 text-white hover:brightness-110`,
      style: { background: link.brandFill },
      iconStyle: undefined,
    };
  }

  // Neutral surface (theme or owner button color); brand tone only recolors the glyph.
  const surface: CSSProperties | undefined = buttonColor
    ? { backgroundColor: buttonColor, color: isColorDark(buttonColor) ? "#ffffff" : "#111827", borderColor: "transparent" }
    : undefined;
  const textClass =
    r.layout === "icons" ? "text-muted-foreground" : "text-foreground";
  const hover = r.tone === "default" && !buttonColor && r.layout === "icons" ? link.hoverClass : "";
  return {
    className: `${shaped} border-border/50 bg-background ${textClass} ${hover}`,
    style: surface,
    iconStyle: r.tone === "brand" ? brandIcon : undefined,
  };
}

interface SocialLinkButtonsProps {
  links: SocialLink[];
  style: SocialLinksStyle | null | undefined;
  /** Owner-chosen surface color (also tints the address pill). null = theme. */
  buttonColor?: string | null;
  /** Render inert spans instead of links (Style picker preview). */
  preview?: boolean;
  className?: string;
}

export function SocialLinkButtons({
  links,
  style,
  buttonColor = null,
  preview = false,
  className = "",
}: SocialLinkButtonsProps) {
  const r = resolveSocialLinksStyle(style);
  const showLabel = r.layout === "chips" || r.layout === "stack";

  return (
    <div className={`${CONTAINER_CLASS[r.layout][r.size]} ${className}`}>
      {links.map((link) => {
        const Icon = link.icon;
        const { className: itemClass, style: itemStyle, iconStyle } = presentLink(link, r, buttonColor);
        const content = (
          <>
            <Icon className={`shrink-0 ${ICON_CLASS[r.layout][r.size]}`} style={iconStyle} />
            {showLabel && <span className="truncate">{link.label}</span>}
            {r.layout === "stack" && (
              <ArrowUpRight
                aria-hidden
                className="absolute right-4 h-4 w-4 opacity-40 transition-opacity group-hover:opacity-80"
              />
            )}
          </>
        );
        if (preview) {
          return (
            <span key={link.key} className={itemClass} style={itemStyle}>
              {content}
            </span>
          );
        }
        const external = link.key !== "email";
        return (
          <a
            key={link.key}
            href={link.href}
            aria-label={showLabel ? undefined : link.label}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className={itemClass}
            style={itemStyle}
          >
            {content}
          </a>
        );
      })}
    </div>
  );
}
