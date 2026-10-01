"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChrome } from "@/contexts/ChromeContext";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * The only piece of Nandzz chrome a logged-out visitor sees on a public profile.
 * The top Navbar is suppressed for these visitors (see AppChrome) so the page
 * reads as the owner's own branded page — Linktree-style. This floating pill is
 * the lone, unobtrusive affordance: it carries the Nandzz wordmark (the "powered
 * by" signal + growth funnel) and the sign-in path.
 *
 * Rendered OUTSIDE the profile's theme-locked wrapper, so it follows the
 * visitor's device theme like the rest of the app chrome. It tucks away with the
 * shared chrome hide-on-scroll gesture (`useChrome`).
 */
export function ProfileVisitorCta() {
  const { isHidden } = useChrome();
  const { t } = useLanguage();

  return (
    <div
      aria-hidden={isHidden || undefined}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2",
        "pointer-events-none", // only the pill itself is interactive
        "transition-transform duration-300 ease-out motion-reduce:transition-none will-change-transform",
        isHidden && "translate-y-[calc(100%+1rem)]"
      )}
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-background/80 py-1.5 pl-3 pr-1.5 shadow-lg backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        {/* Wordmark — the "powered by Nandzz" signal; links home. */}
        <Link href="/" className="group flex items-center gap-0 pr-1 text-sm font-bold tracking-tight">
          <span>nand</span>
          <span className="text-violet-600 transition-colors group-hover:text-violet-500">zz</span>
        </Link>

        {/* Quiet secondary: sign in (returning users). */}
        <Link
          href="/login"
          className="rounded-full px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t.nav.login}
        </Link>

        {/* Primary CTA: create your own page (the growth funnel). */}
        <Link
          href="/login?tab=signup"
          className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {t.nav.createYours}
        </Link>
      </div>
    </div>
  );
}
