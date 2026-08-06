"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Rss,
  Compass,
  LayoutGrid,
  Bot,
  Blocks,
  CreditCard,
  Settings,
  Plug,
  Moon,
  Sun,
  LogOut,
  User,
} from "lucide-react";
import type { ProfileLite } from "@/lib/types";
import { FEATURES } from "@/lib/flags";
import { NotificationBell } from "./NotificationBell";
import { AiJobsIndicator } from "./AiJobsIndicator";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: (pathname: string) => boolean;
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  initialProfile?: ProfileLite | null;
}

export function Sidebar({ collapsed, onToggle, initialProfile = null }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [profile, setProfile] = useState<ProfileLite | null>(initialProfile);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
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

  const username = profile?.username ?? null;

  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      {
        href: "/dashboard/feed",
        label: t.nav.feed,
        icon: Rss,
        isActive: (p) => p.startsWith("/dashboard/feed"),
      },
      {
        href: "/explore",
        label: t.nav.explore,
        icon: Compass,
        isActive: (p) => p.startsWith("/explore"),
      },
    ];

    if (FEATURES.widgets) {
      items.push({
        href: "/dashboard/widgets",
        label: "Widgets",
        icon: Blocks,
        isActive: (p) => p.startsWith("/dashboard/widgets"),
      });
    }

    if (FEATURES.agent && username) {
      items.push({
        href: `/${username}/agent`,
        label: t.nav.myAgent,
        icon: Bot,
        isActive: (p) => p.startsWith(`/${username}/agent`),
      });
    }

    items.push({
      href: "/dashboard",
      label: t.nav.mySpaces,
      icon: LayoutGrid,
      isActive: (p) =>
        p === "/dashboard" ||
        (p.startsWith("/dashboard/") &&
          !p.startsWith("/dashboard/feed") &&
          !p.startsWith("/dashboard/create-space") &&
          !p.startsWith("/dashboard/collections") &&
          !p.startsWith("/dashboard/widgets") &&
          !p.startsWith("/dashboard/credits") &&
          !p.startsWith("/dashboard/settings")),
    });

    if (FEATURES.monetization) {
      items.push({
        href: "/dashboard/credits",
        label: "Credits",
        icon: CreditCard,
        isActive: (p) => p.startsWith("/dashboard/credits"),
      });
    }

    return items;
  }, [t, username]);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col fixed inset-y-0 left-0 z-40 border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        "transition-[width] duration-300 ease-out motion-reduce:transition-none",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Top: collapse toggle + profile */}
      <div className={cn("flex flex-col gap-3 border-b border-sidebar-border p-3", collapsed && "items-center")}>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>

        {collapsed ? (
          <Link
            href={username ? `/${username}` : "/dashboard/settings"}
            title={profile?.display_name || username || "Profile"}
            className="flex justify-center rounded-md p-1.5 -m-1.5 hover:bg-sidebar-accent transition-colors"
          >
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || username || "User avatar"} />
              <AvatarFallback className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 text-sm font-medium">
                {profile?.display_name?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Name + picture on the left, bell on the right */}
            <div className="flex items-center gap-2.5">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || username || "User avatar"} />
                <AvatarFallback className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 text-sm font-medium">
                  {profile?.display_name?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-none truncate">
                  {profile?.display_name || username || "User"}
                </p>
                {username && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">@{username}</p>
                )}
              </div>
              {user && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <AiJobsIndicator userId={user.id} />
                  <NotificationBell userId={user.id} />
                </div>
              )}
            </div>

            {/* View profile */}
            <Link
              href={username ? `/${username}` : "/dashboard/settings"}
              className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
            >
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.nav.viewProfile}</span>
            </Link>
          </div>
        )}
      </div>

      {/* Middle: nav */}
      <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
                collapsed && "justify-center"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-violet-600")} strokeWidth={active ? 2.5 : 2} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: settings, MCP, theme, logout */}
      <div className="border-t border-sidebar-border p-2 flex flex-col gap-0.5">
        <Link
          href="/dashboard/settings"
          title={t.nav.settings}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
            pathname.startsWith("/dashboard/settings")
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
            collapsed && "justify-center"
          )}
        >
          <Settings className={cn("h-4 w-4 shrink-0", pathname.startsWith("/dashboard/settings") && "text-violet-600")} />
          {!collapsed && <span className="truncate">{t.nav.settings}</span>}
        </Link>

        <Link
          href="/mcp"
          title={t.nav.mcp}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
            pathname.startsWith("/mcp")
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
            collapsed && "justify-center"
          )}
        >
          <Plug className={cn("h-4 w-4 shrink-0", pathname.startsWith("/mcp") && "text-violet-600")} />
          {!collapsed && <span className="truncate">{t.nav.mcp}</span>}
        </Link>

        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? t.nav.switchLight : t.nav.switchDark}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors",
            collapsed && "justify-center"
          )}
        >
          {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {!collapsed && <span className="truncate">{theme === "dark" ? t.nav.switchLight : t.nav.switchDark}</span>}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          title={t.nav.logout}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate">{t.nav.logout}</span>}
        </button>
      </div>
    </aside>
  );
}
