"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChrome } from "@/contexts/ChromeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { demoNotice, useDemoNotice } from "@/features/claim/lib/demo-notice-store";

/**
 * Floating pill on DEMO profile pages only: the Nandzz wordmark, the "why am I
 * seeing this?" disclosure and the "Demo page · Claim it" chip. Real profiles
 * carry no Nandzz badge (removed 2026-11-26), so this renders nothing there.
 *
 * Rendered OUTSIDE the profile's theme-locked wrapper, so it follows the
 * visitor's device theme like the rest of the app chrome. It tucks away with the
 * shared chrome hide-on-scroll gesture (`useChrome`).
 */
export function ProfileVisitorCta() {
  const { isHidden } = useChrome();
  const { t } = useLanguage();
  // Set by DemoNoticeSheet, which only mounts on demo pages.
  const { username: demoUsername } = useDemoNotice();
  if (!demoUsername) return null;

  return (
    <div
      data-profile-badge
      aria-hidden={isHidden || undefined}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex flex-col items-center justify-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2",
        "pointer-events-none", // only the pill itself is interactive
        "transition-transform duration-300 ease-out motion-reduce:transition-none will-change-transform",
        isHidden && "translate-y-[calc(100%+1rem)]",
      )}
    >
      {/* The "why am I seeing this?" disclosure, always one tap away. */}
      <button
        type="button"
        onClick={demoNotice.openWhy}
        className="pointer-events-auto max-w-full rounded-full border bg-background/80 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-md backdrop-blur-xl transition-colors hover:text-foreground supports-[backdrop-filter]:bg-background/60"
      >
        {t.demoNotice.whyButton}
      </button>
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-background/80 py-1.5 pl-3 pr-1.5 shadow-lg backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <Link
          href="/"
          className="group flex items-center gap-0 pr-1 text-sm font-bold tracking-tight"
        >
          <span>nand</span>
          <span className="text-violet-600 transition-colors group-hover:text-violet-500">
            zz
          </span>
        </Link>
        <button
          type="button"
          onClick={demoNotice.open}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3.5 py-1.5 text-sm font-semibold text-zinc-950 shadow-sm transition-colors hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {t.demoNotice.badge}
          <span aria-hidden className="opacity-50">·</span>
          {t.demoNotice.pillCta}
        </button>
      </div>
    </div>
  );
}
