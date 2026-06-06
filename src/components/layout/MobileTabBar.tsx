"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Home, Compass, Plus, LayoutGrid, User, LogIn, Rss } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

type TabDef = {
  href: string;
  labelKey: string;
  icon: React.ElementType;
  isActive: (pathname: string) => boolean;
  highlight?: boolean;
};

const UNAUTH_TAB_DEFS: TabDef[] = [
  { href: "/", labelKey: "home", icon: Home, isActive: (p) => p === "/" },
  { href: "/explore", labelKey: "explore", icon: Compass, isActive: (p) => p.startsWith("/explore") },
  { href: "/login", labelKey: "signIn", icon: LogIn, isActive: (p) => p.startsWith("/login") },
];

function getAuthTabDefs(username: string | null): TabDef[] {
  return [
    { href: "/dashboard/feed", labelKey: "feed", icon: Rss, isActive: (p) => p.startsWith("/dashboard/feed") },
    { href: "/explore", labelKey: "explore", icon: Compass, isActive: (p) => p.startsWith("/explore") },
    { href: "/dashboard/create-space", labelKey: "create", icon: Plus, isActive: (p) => p.startsWith("/dashboard/create-space"), highlight: true },
    { href: "/dashboard", labelKey: "spaces", icon: LayoutGrid, isActive: (p) => p === "/dashboard" || (p.startsWith("/dashboard") && !p.startsWith("/dashboard/create-space")) },
    { href: username ? `/${username}` : "/dashboard/settings", labelKey: "profile", icon: User, isActive: (p) => username ? p === `/${username}` : false },
  ];
}

export function MobileTabBar() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const { t } = useLanguage();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single();
    if (data) setProfile(data as Profile);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user);
        fetchProfile(user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

  const tabDefs = user ? getAuthTabDefs(profile?.username ?? null) : UNAUTH_TAB_DEFS;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-16 items-center justify-around px-1">
        {tabDefs.map((tab) => {
          const active = tab.isActive(pathname);
          const Icon = tab.icon;
          const label = t.mobileTab[tab.labelKey as keyof typeof t.mobileTab];

          if (tab.highlight) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-2"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-500/30 transition-transform active:scale-95">
                  <Icon className="h-5 w-5" />
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-2"
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  active ? "text-violet-600" : "text-muted-foreground"
                )}
                strokeWidth={active ? 2.5 : 1.75}
              />
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors w-full text-center truncate px-0.5",
                  active ? "text-violet-600" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
