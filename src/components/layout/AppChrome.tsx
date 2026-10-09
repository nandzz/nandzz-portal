"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navbar, Sidebar, MobileTabBar, ProfileVisitorCta } from "@/features/analytics";
import { useAuth } from "@/features/auth/AuthContext";
import { ConditionalFooter } from "./ConditionalFooter";
import { SIDEBAR_COLLAPSED_COOKIE, isBareAuthRoute, isImmersiveRoute, isProfilePage, isWidgetRoute } from "@/lib/layout/appShell";
import { cn } from "@/lib/utils";
import { useChrome } from "@/contexts/ChromeContext";

// Pre-cookie home of the collapse preference (see SIDEBAR_COLLAPSED_COOKIE).
const LEGACY_STORAGE_KEY = "sidebar:collapsed";

function persistCollapsed(value: boolean) {
  document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${value ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
}

interface AppChromeProps {
  /** Saved preference, read server-side from the cookie. */
  initialCollapsed: boolean;
  children: React.ReactNode;
}

export function AppChrome({ initialCollapsed, children }: AppChromeProps) {
  const pathname = usePathname();
  const { userId } = useAuth();
  const onProfilePage = isProfilePage(pathname);
  // Profile pages start on the rail (full-width profile); everywhere else
  // starts on the saved preference — both known at render, so no flip.
  const preference = useRef(initialCollapsed);
  const [collapsed, setCollapsed] = useState(onProfilePage || initialCollapsed);
  const { profilePreview, setProfilePreview } = useChrome();

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

  // One-time migration of the old localStorage preference to the cookie.
  useEffect(() => {
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy === null) return;
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    preference.current = legacy === "true";
    persistCollapsed(preference.current);
    if (!isProfilePage(window.location.pathname)) setCollapsed(preference.current);
  }, []);

  // Navigating onto a profile collapses to the rail; leaving restores the saved
  // preference. The toggle can still override for the current visit.
  const wasProfile = useRef(onProfilePage);
  useEffect(() => {
    if (wasProfile.current === onProfilePage) return;
    wasProfile.current = onProfilePage;
    setCollapsed(onProfilePage || preference.current);
  }, [onProfilePage]);

  const handleToggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      // Persist the preference only on normal pages. On a profile page the
      // collapse is an ephemeral default, so toggling it back open doesn't
      // change the saved preference used elsewhere.
      if (!isProfilePage(pathname)) {
        preference.current = next;
        persistCollapsed(next);
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
