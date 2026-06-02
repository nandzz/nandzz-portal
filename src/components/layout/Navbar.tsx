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
import { Moon, Sun, Menu, User, Settings, LogOut, CreditCard, Compass, Rss, Plus, LayoutGrid, Layers } from "lucide-react";
import type { Profile } from "@/lib/types";
import { FEATURES } from "@/lib/flags";

export function Navbar() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
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
    <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
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
              Explore
            </Link>
            {FEATURES.monetization && (
              <Link
                href="/pricing"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Pricing
              </Link>
            )}
            {user && (
              <Link
                href="/dashboard/feed"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Feed
              </Link>
            )}
            {user && (
              <Link
                href="/dashboard/create-space"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Create
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                My Spaces
              </Link>
              <Link
                href="/dashboard/collections"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                My Collections
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer transition-transform hover:scale-105">
                  <Avatar className="h-8 w-8 border-2 border-transparent hover:border-violet-500/50 transition-colors">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 text-sm font-medium">
                      {profile?.display_name?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* User info header */}
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={profile?.avatar_url || undefined} />
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

                  {/* Navigation */}
                  <DropdownMenuGroup>
                    {profile?.username && (
                      <DropdownMenuItem
                        onClick={() => router.push(`/${profile.username}`)}
                        className="gap-2"
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                        My Profile
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => router.push("/dashboard/settings")}
                      className="gap-2"
                    >
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      Settings
                    </DropdownMenuItem>
                    {FEATURES.monetization && (
                      <DropdownMenuItem
                        onClick={() => router.push("/dashboard/billing")}
                        className="gap-2"
                      >
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        Billing & Plans
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  {/* Preferences */}
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      className="gap-2"
                    >
                      {theme === "dark" ? (
                        <Sun className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Moon className="h-4 w-4 text-muted-foreground" />
                      )}
                      {theme === "dark" ? "Switch to Light" : "Switch to Dark"}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  {/* Destructive */}
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/login?tab=signup">
                <Button
                  size="sm"
                >
                  Sign up
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile menu button */}
          <DropdownMenu>
            <DropdownMenuTrigger className="h-9 w-9 md:hidden inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
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
                          <AvatarImage src={profile?.avatar_url || undefined} />
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

                  {/* Navigation */}
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => router.push("/explore")} className="gap-2">
                      <Compass className="h-4 w-4 text-muted-foreground" />
                      Explore
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/dashboard/feed")} className="gap-2">
                      <Rss className="h-4 w-4 text-muted-foreground" />
                      Feed
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/dashboard/create-space")} className="gap-2">
                      <Plus className="h-4 w-4 text-muted-foreground" />
                      Create Space
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/dashboard")} className="gap-2">
                      <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                      My Spaces
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/dashboard/collections")} className="gap-2">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      My Collections
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  {/* Account */}
                  <DropdownMenuGroup>
                    {profile?.username && (
                      <DropdownMenuItem onClick={() => router.push(`/${profile.username}`)} className="gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        My Profile
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => router.push("/dashboard/settings")} className="gap-2">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      Settings
                    </DropdownMenuItem>
                    {FEATURES.monetization && (
                      <DropdownMenuItem onClick={() => router.push("/dashboard/billing")} className="gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        Billing & Plans
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
                    {theme === "dark" ? "Switch to Light" : "Switch to Dark"}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={handleLogout} className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10">
                    <LogOut className="h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => router.push("/explore")} className="gap-2">
                      <Compass className="h-4 w-4 text-muted-foreground" />
                      Explore
                    </DropdownMenuItem>
                    {FEATURES.monetization && (
                      <DropdownMenuItem onClick={() => router.push("/pricing")} className="gap-2">
                        Pricing
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/login")} className="gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Log in
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/login?tab=signup")} className="gap-2">
                    Sign up
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
