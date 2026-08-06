"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
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
import { Moon, Sun, Menu, User, UserPlus, Settings, LogOut, CreditCard, Compass, Bot, Plug, Blocks } from "lucide-react";
import type { Profile } from "@/lib/types";
import { FEATURES } from "@/lib/flags";
import { NotificationBell } from "./NotificationBell";
import { AiJobsIndicator } from "./AiJobsIndicator";
import { useLanguage } from "@/contexts/LanguageContext";
import { useChrome } from "@/contexts/ChromeContext";
import { cn } from "@/lib/utils";

export function Navbar() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const { isHidden } = useChrome();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) setProfile(data);
  }, [supabase]);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        fetchProfile(user.id);
      }
    };
    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  useEffect(() => {
    const handler = () => {
      if (user) fetchProfile(user.id);
    };
    window.addEventListener("profile-updated", handler);
    return () => window.removeEventListener("profile-updated", handler);
  }, [user, fetchProfile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.refresh();
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
            <Link
              href="/explore"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {t.nav.explore}
            </Link>
            {user && FEATURES.monetization && (
              <Link
                href="/pricing"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {t.nav.pricing}
              </Link>
            )}
            {user && (
              <Link
                href="/dashboard/feed"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {t.nav.feed}
              </Link>
            )}
            {user && (
              <Link
                href="/dashboard/create-space"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {t.nav.create}
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="hidden md:flex items-center gap-3">
              {FEATURES.widgets && (
                <Link
                  href="/dashboard/widgets"
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Blocks className="h-3.5 w-3.5" />
                  Widgets
                </Link>
              )}
              {FEATURES.agent && profile?.username && (
                <Link
                  href={`/${profile.username}/agent`}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Bot className="h-3.5 w-3.5" />
                  {t.nav.myAgent}
                </Link>
              )}
              <Link
                href="/dashboard"
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
          {user && <AiJobsIndicator userId={user.id} />}
          {user && <NotificationBell userId={user.id} />}

          {/* Avatar dropdown — desktop only, after the bell */}
          {user && (
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
                      <DropdownMenuItem onClick={() => router.push(`/${profile.username}`)} className="gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {t.nav.profile}
                      </DropdownMenuItem>
                    )}
                    {FEATURES.agent && profile?.username && (
                      <DropdownMenuItem onClick={() => router.push(`/${profile.username}/agent`)} className="gap-2">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                        {t.nav.myAgent}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => router.push("/dashboard/settings")} className="gap-2">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      {t.nav.settings}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/mcp")} className="gap-2">
                      <Plug className="h-4 w-4 text-muted-foreground" />
                      {t.nav.mcp}
                    </DropdownMenuItem>
                    {FEATURES.monetization && (
                      <DropdownMenuItem onClick={() => router.push("/dashboard/credits")} className="gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        Credits
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
              {user ? (
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

                  {/* Navigation — Feed/Explore/Spaces/Profile live in the bottom tab bar */}
                  <DropdownMenuGroup>
                    {FEATURES.widgets && (
                      <DropdownMenuItem onClick={() => router.push("/dashboard/widgets")} className="gap-2">
                        <Blocks className="h-4 w-4 text-muted-foreground" />
                        Widgets
                      </DropdownMenuItem>
                    )}
                    {FEATURES.agent && profile?.username && (
                      <DropdownMenuItem onClick={() => router.push(`/${profile.username}/agent`)} className="gap-2">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                        {t.nav.myAgent}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  {/* Account */}
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => router.push("/dashboard/settings")} className="gap-2">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      {t.nav.settings}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/mcp")} className="gap-2">
                      <Plug className="h-4 w-4 text-muted-foreground" />
                      {t.nav.mcp}
                    </DropdownMenuItem>
                    {FEATURES.monetization && (
                      <DropdownMenuItem onClick={() => router.push("/dashboard/credits")} className="gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        Credits
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
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => router.push("/explore")} className="gap-2">
                      <Compass className="h-4 w-4 text-muted-foreground" />
                      {t.nav.explore}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/login")} className="gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {t.nav.login}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/login?tab=signup")} className="gap-2">
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                    {t.nav.signup}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
