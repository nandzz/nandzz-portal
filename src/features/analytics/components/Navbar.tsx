"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Moon, Sun, Menu, User, UserPlus, Settings, LogOut, CreditCard, Plug, CalendarDays, BarChart3, Palette, Briefcase, Plus } from "lucide-react";
import { FEATURES } from "@/lib/flags";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NotificationBell } from "./NotificationBell";
import { AiJobsIndicator } from "./AiJobsIndicator";
import { useLanguage } from "@/contexts/LanguageContext";
import { useChrome } from "@/contexts/ChromeContext";
import { cn } from "@/lib/utils";
import { setAccountType } from "../auth";
import { useAuth } from "../AuthContext";

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const { isHidden } = useChrome();
  const { userId, profile, entitlements, flags } = useAuth();
  const [switchOpen, setSwitchOpen] = useState(false);

  // Business account gates the Business sections; default (personal) until the
  // profile resolves so business-only chrome never flashes.
  const isBusiness = profile?.account_type === "business";

  // The mobile top-bar avatar links straight to the public profile; before a
  // username exists (mid-onboarding) it falls back to settings.
  const profileHref = profile?.username ? `/${profile.username}` : "/dashboard/settings";

  const handleSwitchToBusiness = useCallback(async () => {
    if (!userId) return;
    const ok = await setAccountType(userId, "business");
    if (ok) {
      // The provider's own `profile-updated` listener re-reads the row.
      window.dispatchEvent(new Event("profile-updated"));
    }
  }, [userId]);

  const handleLogout = () => {
    // Hand off to the server sign-out route: it clears the auth cookies on its
    // response and redirects to the public home page, guaranteeing a full
    // sign-out (client-only sign-out left the SSR session cookies behind).
    window.location.href = "/auth/signout";
  };

  return (
    <nav
      aria-hidden={isHidden || undefined}
      className={cn(
        "sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60",
        "transition-transform duration-300 ease-out motion-reduce:transition-none will-change-transform",
        isHidden && "max-md:-translate-y-full max-md:pointer-events-none"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-0 group">
            <span className="text-xl font-bold tracking-tight">nand</span>
            <span className="text-xl font-bold tracking-tight text-violet-600 transition-colors group-hover:text-violet-500">zz</span>
          </Link>

          {/* Nav links - desktop */}
          <div className="hidden items-center gap-1 md:flex">
            {userId && FEATURES.monetization && (
              <Link
                href="/pricing"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {t.nav.pricing}
              </Link>
            )}
            {userId && !isBusiness && (
              <Link
                href="/dashboard/feed"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {t.nav.feed}
              </Link>
            )}
            {userId && (
              <Link
                href="/dashboard/contents/create-space"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {t.nav.create}
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {userId ? (
            <div className="hidden md:flex items-center gap-3">
              {isBusiness && FEATURES.widgets && entitlements.hasWidgets && (
                <Link
                  href="/dashboard/widgets"
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Booking
                </Link>
              )}
              <Link
                href="/dashboard/contents"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {t.nav.mySpaces}
              </Link>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  {t.nav.login}
                </Button>
              </Link>
              <Link href="/login?tab=signup">
                <Button size="sm">
                  {t.nav.signup}
                </Button>
              </Link>
            </div>
          )}

          {/* AI jobs indicator + notification bell */}
          {userId && flags.ai && <AiJobsIndicator userId={userId} />}
          {userId && <NotificationBell userId={userId} />}

          {/* Mobile-only avatar → profile. On desktop the avatar is the account
              dropdown below; on mobile it's a direct link to the public profile
              and the menu lives in the burger. */}
          {userId && (
            <Link
              href={profileHref}
              aria-label={t.nav.profile}
              className="md:hidden rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-transform active:scale-95"
            >
              <Avatar className="h-8 w-8 border-2 border-transparent">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || profile?.username || "User avatar"} />
                <AvatarFallback className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 text-sm font-medium">
                  {profile?.display_name?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </Link>
          )}

          {/* Avatar dropdown — desktop only, after the bell */}
          {userId && (
            <div className="hidden md:flex">
              <DropdownMenu>
                <DropdownMenuTrigger aria-label="Account menu" className="rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer transition-transform hover:scale-105">
                  <Avatar className="h-8 w-8 border-2 border-transparent hover:border-violet-500/50 transition-colors">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || profile?.username || "User avatar"} />
                    <AvatarFallback className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 text-sm font-medium">
                      {profile?.display_name?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || profile?.username || "User avatar"} />
                          <AvatarFallback className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 text-xs font-semibold">
                            {profile?.display_name?.[0]?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-none truncate">
                            {profile?.display_name || profile?.username || "User"}
                          </p>
                          {profile?.username && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              @{profile.username}
                            </p>
                          )}
                        </div>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  <DropdownMenuGroup>
                    {profile?.username && (
                      <DropdownMenuItem render={<Link href={`/${profile.username}`} />} className="gap-2">
                        <User aria-hidden className="h-4 w-4 text-muted-foreground" />
                        {t.nav.profile}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem render={<Link href="/dashboard/settings" />} className="gap-2">
                      <Settings aria-hidden className="h-4 w-4 text-muted-foreground" />
                      {t.nav.settings}
                    </DropdownMenuItem>
                    {entitlements.hasMcp && (
                      <DropdownMenuItem render={<Link href="/mcp" />} className="gap-2">
                        <Plug aria-hidden className="h-4 w-4 text-muted-foreground" />
                        {t.nav.mcp}
                      </DropdownMenuItem>
                    )}
                    {FEATURES.monetization && (
                      <DropdownMenuItem render={<Link href="/dashboard/credits" />} className="gap-2">
                        <CreditCard aria-hidden className="h-4 w-4 text-muted-foreground" />
                        {t.nav.subscription}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="gap-2">
                      {theme === "dark" ? (
                        <Sun className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Moon className="h-4 w-4 text-muted-foreground" />
                      )}
                      {theme === "dark" ? t.nav.switchLight : t.nav.switchDark}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={handleLogout} className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10">
                    <LogOut className="h-4 w-4" />
                    {t.nav.logout}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Mobile menu button */}
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Open menu" className="h-9 w-9 md:hidden inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
              <Menu className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {userId ? (
                <>
                  {/* User info */}
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || profile?.username || "User avatar"} />
                          <AvatarFallback className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 text-xs font-semibold">
                            {profile?.display_name?.[0]?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-none truncate">
                            {profile?.display_name || profile?.username || "User"}
                          </p>
                          {profile?.username && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              @{profile.username}
                            </p>
                          )}
                        </div>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  {/* Business — the whole menu leads with the account's headline
                      action. For a personal account that's the conversion CTA
                      (the single most valuable thing they can do here); for a
                      business it's the Business tools. Everyday navigation
                      (Profile, Bookings, Feed, Content) lives in the bottom tab
                      bar; Followers/Following are tappable counts on the profile —
                      none of it is duplicated here. */}
                  {!isBusiness ? (
                    <>
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onClick={() => setSwitchOpen(true)}
                          className="gap-2 font-medium text-violet-600 focus:text-violet-600 focus:bg-violet-50 dark:focus:bg-violet-950/40"
                        >
                          <Briefcase aria-hidden className="h-4 w-4" />
                          {t.nav.switchToBusiness}
                        </DropdownMenuItem>
                      </DropdownMenuGroup>

                      <DropdownMenuSeparator />
                    </>
                  ) : (
                    ((FEATURES.widgets && entitlements.hasWidgets) || FEATURES.brand || entitlements.hasAnalytics) && (
                      <>
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {t.nav.groupBusiness}
                          </DropdownMenuLabel>
                          {FEATURES.widgets && entitlements.hasWidgets && (
                            <DropdownMenuItem render={<Link href="/dashboard/widgets" />} className="gap-2">
                              <CalendarDays aria-hidden className="h-4 w-4 text-muted-foreground" />
                              Booking
                            </DropdownMenuItem>
                          )}
                          {FEATURES.brand && (
                            <DropdownMenuItem render={<Link href="/dashboard/brand" />} className="gap-2">
                              <Palette aria-hidden className="h-4 w-4 text-muted-foreground" />
                              Brand
                            </DropdownMenuItem>
                          )}
                          {entitlements.hasAnalytics && (
                            <DropdownMenuItem render={<Link href="/dashboard/analytics" />} className="gap-2">
                              <BarChart3 aria-hidden className="h-4 w-4 text-muted-foreground" />
                              {t.nav.analytics}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>

                        <DropdownMenuSeparator />
                      </>
                    )
                  )}

                  {/* Create — the one content action that isn't a tab-bar destination. */}
                  <DropdownMenuGroup>
                    <DropdownMenuItem render={<Link href="/dashboard/contents/create-space" />} className="gap-2">
                      <Plus aria-hidden className="h-4 w-4 text-muted-foreground" />
                      {t.nav.create}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  {/* Settings */}
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t.nav.groupSettings}
                    </DropdownMenuLabel>
                    <DropdownMenuItem render={<Link href="/dashboard/settings" />} className="gap-2">
                      <Settings aria-hidden className="h-4 w-4 text-muted-foreground" />
                      {t.nav.settings}
                    </DropdownMenuItem>
                    {FEATURES.monetization && (
                      <DropdownMenuItem render={<Link href="/dashboard/credits" />} className="gap-2">
                        <CreditCard aria-hidden className="h-4 w-4 text-muted-foreground" />
                        {t.nav.subscription}
                      </DropdownMenuItem>
                    )}
                    {entitlements.hasMcp && (
                      <DropdownMenuItem render={<Link href="/mcp" />} className="gap-2">
                        <Plug aria-hidden className="h-4 w-4 text-muted-foreground" />
                        {t.nav.mcp}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="gap-2">
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Moon className="h-4 w-4 text-muted-foreground" />
                    )}
                    {theme === "dark" ? t.nav.switchLight : t.nav.switchDark}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={handleLogout} className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10">
                    <LogOut className="h-4 w-4" />
                    {t.nav.logout}
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem render={<Link href="/login" />} className="gap-2">
                    <User aria-hidden className="h-4 w-4 text-muted-foreground" />
                    {t.nav.login}
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/login?tab=signup" />} className="gap-2">
                    <UserPlus aria-hidden className="h-4 w-4 text-muted-foreground" />
                    {t.nav.signup}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ConfirmDialog
        open={switchOpen}
        onClose={() => setSwitchOpen(false)}
        onConfirm={handleSwitchToBusiness}
        title={t.nav.switchToBusinessTitle}
        description={t.nav.switchToBusinessDesc}
        confirmLabel={t.nav.switchToBusinessConfirm}
        cancelLabel={t.common.cancel}
        variant="default"
      />
    </nav>
  );
}
