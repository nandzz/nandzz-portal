"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Navbar, Sidebar, MobileTabBar, ProfileVisitorCta } from "@/features/analytics";
import { useAuth } from "@/features/auth/AuthContext";
import { ConditionalFooter } from "./ConditionalFooter";
import { isBareAuthRoute, isImmersiveRoute, isProfilePage, isWidgetRoute } from "@/lib/layout/appShell";
import { cn } from "@/lib/utils";
import { useChrome } from "@/contexts/ChromeContext";

const COLLAPSE_STORAGE_KEY = "sidebar:collapsed";

interface AppChromeProps {
  children: React.ReactNode;
}

export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const { userId } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const { profilePreview, setProfilePreview } = useChrome();

  const onProfilePage = isProfilePage(pathname);
  // The public booking widget is a self-contained, branded page: it renders its
  // own hero and controls, so every piece of app chrome is suppressed.
  const onWidgetPage = isWidgetRoute(pathname);
  // The immersive space viewer renders its own top bar (back / title / actions),
  // so the app Navbar is suppressed there too — leaving the viewer chromeless
  // above its own header.
  const onImmersivePage = isImmersiveRoute(pathname);
  // Post-signup onboarding (choose-a-username): the visitor is authenticated but
  // mid-setup, so no sidebar/navbar/footer/tab bar — just the centered card.
  const onBareAuthPage = isBareAuthRoute(pathname);
  // Owner previewing their own profile as a visitor sees it: no chrome at all
  // (not even the visitor CTA pill). Cleared whenever they leave the profile.
  const previewing = profilePreview && onProfilePage;

  useEffect(() => {
    if (!onProfilePage) setProfilePreview(false);
  }, [onProfilePage, setProfilePreview]);

  useEffect(() => {
    // Auto-collapse to the rail when landing on a profile page (full-width
    // profile); restore the saved preference on any other page. Reads happen
    // after mount — localStorage isn't available during SSR, so server and
    // client both start "expanded", trading a one-frame flip for zero
    // hydration mismatch. The toggle can still override for the current visit.
    if (onProfilePage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(true);
    } else {
      const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
      setCollapsed(stored === "true");
    }
  }, [onProfilePage]);

  const handleToggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      // Persist the preference only on normal pages. On a profile page the
      // collapse is an ephemeral default, so toggling it back open doesn't
      // change the saved preference used elsewhere.
      if (!isProfilePage(pathname)) {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      }
      return next;
    });
  }, [pathname]);

  // When signed in, the sidebar is the app chrome everywhere except the
  // immersive space viewer (which keeps its own chrome-hide gesture).
  const showSidebar = !!userId && !isImmersiveRoute(pathname) && !onBareAuthPage && !previewing;

  // A logged-out visitor on someone's profile: suppress ALL Nandzz chrome (top
  // Navbar + footer) so the page reads as the owner's own branded page
  // (Linktree-style). Their only Nandzz affordance is the floating CTA pill.
  const isVisitorProfile = !userId && onProfilePage;

  return (
    <>
      {showSidebar && (
        <Sidebar collapsed={collapsed} onToggle={handleToggleCollapsed} />
      )}

      {/* Top Navbar only when the sidebar isn't taking over (logged out). On
          mobile it stays visible since the sidebar is desktop-only. Widget and
          immersive space pages never show it — they render their own chrome —
          and neither does a logged-out visitor on a profile (clean branded
          page; the floating CTA pill is their only Nandzz affordance). */}
      {!onWidgetPage && !onImmersivePage && !onBareAuthPage && !isVisitorProfile && !previewing && (
        <div className={cn(showSidebar && "md:hidden")}>
          <Navbar />
        </div>
      )}

      <main
        className={cn(
          "flex-1 transition-[padding] duration-300 ease-out motion-reduce:transition-none",
          // Bottom clearance: the floating CTA pill shows on every breakpoint for
          // a logged-out profile visitor, so reserve space on all sizes; the
          // MobileTabBar is mobile-only (hidden at md+), so its clearance resets
          // at md+; widget/onboarding own their viewport (none).
          isVisitorProfile
            ? "pb-24"
            : onWidgetPage || onBareAuthPage || previewing
              ? "pb-0"
              : "pb-16 md:pb-0",
          showSidebar && (collapsed ? "md:pl-16" : "md:pl-64")
        )}
      >
        {children}
      </main>

      {!showSidebar && !onWidgetPage && !onBareAuthPage && !isVisitorProfile && !previewing && <ConditionalFooter />}

      {/* Hidden for logged-out visitors on a profile page, on the widget page
          (which owns its whole viewport), and during post-signup onboarding. */}
      {!isVisitorProfile && !onWidgetPage && !onBareAuthPage && !previewing && <MobileTabBar />}

      {/* The lone Nandzz affordance on a clean, logged-out profile page:
          a floating "Sign in / Create your page" pill. */}
      {isVisitorProfile && <ProfileVisitorCta />}
    </>
  );
}
