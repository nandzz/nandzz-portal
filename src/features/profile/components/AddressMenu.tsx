"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Copy, ExternalLink, MapPin, Share2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProfileAddress } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

// Universal Google Maps deep-link — opens the Maps app on mobile, the web map
// on desktop. `query_place_id` (when we captured one via Places Autocomplete)
// pins the exact place instead of doing a fuzzy text search.
function buildMapsUrl(formatted: string, placeId?: string): string {
  const params = new URLSearchParams({ api: "1", query: formatted });
  if (placeId) params.set("query_place_id", placeId);
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

// Compact chip label: the city, taken from Google's "street, …, <postcode city
// province>, country" shape by dropping the country and stripping postcode /
// province tokens from the locality segment. Falls back to the full string when
// the shape doesn't match, so the chip never ends up empty.
function shortLabel(formatted: string): string {
  const parts = formatted.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3) return formatted;
  const city = parts[parts.length - 2]
    .split(/\s+/)
    .filter((tok) => !/\d/.test(tok) && !/^[A-Z]{1,3}$/.test(tok))
    .join(" ");
  return city || formatted;
}

const noopSubscribe = () => () => {};

type AddressMenuProps = {
  address: ProfileAddress;
  shareTitle: string;
  style?: React.CSSProperties;
};

export function AddressMenu({ address, shareTitle, style }: AddressMenuProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // navigator.share only exists client-side (and not on most desktops); the
  // server snapshot is false so SSR and hydration agree.
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const mapsUrl = buildMapsUrl(address.formatted, address.place_id);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      clearTimeout(closeTimer.current);
      setCopied(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address.formatted);
    } catch {
      return;
    }
    // Keep the menu open briefly so the confirmation is actually seen.
    setCopied(true);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => handleOpenChange(false), 900);
  }

  async function handleShare() {
    try {
      await navigator.share({ title: shareTitle, text: address.formatted, url: mapsUrl });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        style={style}
        title={address.formatted}
        className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/50 bg-background px-3 py-1.5 text-sm text-muted-foreground transition-[color,box-shadow,transform] duration-150 ease-out hover:text-violet-600 hover:shadow-sm active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 data-[popup-open]:text-violet-600 dark:hover:text-violet-400 dark:data-[popup-open]:text-violet-400"
      >
        <MapPin className="h-4 w-4 shrink-0" />
        <span className="truncate">{shortLabel(address.formatted)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" sideOffset={6} className="w-auto max-w-[min(20rem,calc(100vw-2rem))]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 text-xs leading-snug font-normal break-words whitespace-normal">
            {address.formatted}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="px-2 py-1.5"
          render={<a href={mapsUrl} target="_blank" rel="noopener noreferrer" />}
        >
          <ExternalLink />
          {t.profile.addressOpenMaps}
        </DropdownMenuItem>
        <DropdownMenuItem className="px-2 py-1.5" closeOnClick={false} onClick={handleCopy}>
          {copied ? <Check className="text-emerald-600" /> : <Copy />}
          {copied ? t.profile.addressCopied : t.profile.addressCopy}
        </DropdownMenuItem>
        {canShare && (
          <DropdownMenuItem className="px-2 py-1.5" onClick={handleShare}>
            <Share2 />
            {t.profile.addressShare}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
