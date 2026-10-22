"use client";

import { useState } from "react";
import { ArrowUpRight, Globe } from "lucide-react";
import { HoverPrefetchLink } from "@/components/HoverPrefetchLink";
import type { Space } from "@/lib/types";
import { getFaviconUrl, getLinkHost, getLinkTarget } from "@/lib/spaces/links";
import { isColorDark } from "@/lib/color";

/** Shared href / host / favicon resolution for the image-less link styles. */
function useLinkInfo(space: Space) {
  const target = getLinkTarget(space);
  return {
    href: target ?? `/space/${space.id}`,
    host: getLinkHost(target),
    faviconUrl: getFaviconUrl(target),
    externalProps: target ? { target: "_blank" as const, rel: "noopener noreferrer" } : {},
  };
}

/** The owner's button tint (Style picker) as an inline surface + readable text. */
function tintStyle(buttonColor: string | null | undefined): React.CSSProperties | undefined {
  return buttonColor
    ? { backgroundColor: buttonColor, color: isColorDark(buttonColor) ? "#ffffff" : "#111827", borderColor: "transparent" }
    : undefined;
}

function Favicon({ url, className }: { url: string | null; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <Globe className={`${className} opacity-60`} />;
  // Plain <img>: favicons are tiny and come from an arbitrary host.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={`${className} object-contain`} loading="lazy" onError={() => setFailed(true)} />;
}

interface LinkStyleProps {
  space: Space;
  buttonColor?: string | null;
}

/** "Stack" style: a full-width button row (favicon tile, title + host, arrow).
 * No preview image, so links without a picture still look intentional. */
export function LinkRow({ space, buttonColor }: LinkStyleProps) {
  const { href, host, faviconUrl, externalProps } = useLinkInfo(space);
  const tinted = tintStyle(buttonColor);

  return (
    <HoverPrefetchLink
      href={href}
      {...externalProps}
      style={tinted}
      className="group flex min-h-14 w-full items-center gap-3 rounded-xl border border-foreground/10 bg-background/80 px-2.5 py-2 text-foreground shadow-sm backdrop-blur-sm transition-[transform,border-color,box-shadow] duration-150 ease-out active:scale-[0.98] [@media(hover:hover)]:hover:border-violet-500/40 [@media(hover:hover)]:hover:shadow-md"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-black/5">
        <Favicon url={faviconUrl} className="h-5 w-5 text-neutral-500" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{space.title}</span>
        {host && <span className="mt-0.5 block truncate text-xs opacity-60">{host}</span>}
      </span>
      <ArrowUpRight className="mr-1 h-4 w-4 shrink-0 opacity-50 transition-[transform,opacity] duration-150 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-90" />
    </HoverPrefetchLink>
  );
}

/** "Pills" style: a compact rounded chip (favicon + title) that wraps inline. */
export function LinkPill({ space, buttonColor }: LinkStyleProps) {
  const { href, host, faviconUrl, externalProps } = useLinkInfo(space);
  const tinted = tintStyle(buttonColor);

  return (
    <HoverPrefetchLink
      href={href}
      {...externalProps}
      style={tinted}
      title={host ?? undefined}
      className="inline-flex h-10 max-w-full items-center gap-2 rounded-full border border-foreground/10 bg-background/80 pr-4 pl-1.5 text-foreground shadow-sm backdrop-blur-sm transition-[transform,border-color] duration-150 ease-out active:scale-[0.97] [@media(hover:hover)]:hover:border-violet-500/40"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-black/5">
        <Favicon url={faviconUrl} className="h-4 w-4 text-neutral-500" />
      </span>
      <span className="max-w-[220px] truncate text-sm font-medium">{space.title}</span>
    </HoverPrefetchLink>
  );
}
