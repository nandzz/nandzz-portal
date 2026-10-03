"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Rss,
  LayoutGrid,
  CalendarDays,
  CreditCard,
  Palette,
  Settings,
  Plug,
  Moon,
  Sun,
  LogOut,
  User,
  Calendar,
  Users,
  UserPlus,
  BarChart3,
  Briefcase,
} from "lucide-react";
import { FEATURES } from "@/lib/flags";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NotificationBell } from "./NotificationBell";
import { AiJobsIndicator } from "./AiJobsIndicator";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { setAccountType } from "../auth";
import { useAuth } from "../AuthContext";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: (pathname: string) => boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const { userId, profile, entitlements, flags } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);

  // Account type gates the Business sections. Until the profile resolves we
  // treat the account as personal (the default for every user), so business-only
  // nav never flashes before the profile loads.
  const isBusiness = profile?.account_type === "business";

  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount flag to gate theme-dependent icon rendering (avoids hydration mismatch)
  useEffect(() => setMounted(true), []);

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

  const username = profile?.username ?? null;

  const navGroups: NavGroup[] = useMemo(() => {
    // Account
    const account: NavItem[] = [
      // Feed is a personal-account capability: a business gets followed rather
      // than following creators, so it has no feed.
      ...(!isBusiness
        ? [
            {
              href: "/dashboard/feed",
              label: t.nav.feed,
              icon: Rss,
              isActive: (p: string) => p.startsWith("/dashboard/feed"),
            },
          ]
        : []),
      {
        href: "/dashboard/contents",
        label: t.nav.mySpaces,
        icon: LayoutGrid,
        isActive: (p) =>
          p === "/dashboard/contents" || p.startsWith("/dashboard/contents/"),
      },
      // Bookings is a personal-account capability: a business gets booked
      // rather than books other businesses, so it's hidden for business accounts.
      ...(!isBusiness
        ? [
            {
              href: "/dashboard/bookings",
              label: t.nav.bookings,
              icon: Calendar,
              isActive: (p: string) => p.startsWith("/dashboard/bookings"),
            },
          ]
        : []),
      {
        href: "/dashboard/followers",
        label: t.nav.followers,
        icon: Users,
        isActive: (p) => p.startsWith("/dashboard/followers"),
      },
      {
        href: "/dashboard/following",
        label: t.nav.following,
        icon: UserPlus,
        isActive: (p) => p.startsWith("/dashboard/following"),
      },
    ];

    // Shortcuts — quick links to the tools a business runs day to day. Only
    // shown for business accounts; the first shortcut is Bookings, which opens
    // the calendar (booking) widget where received appointments are managed.
    const shortcuts: NavItem[] = [];
    // Links straight to the workspace's Bookings tab: going via /dashboard/bookings
    // (which server-redirects here) flashed that route's skeleton first.
    if (isBusiness) {
      shortcuts.push({
        href: "/dashboard/booking/bookings",
        label: t.nav.bookings,
        icon: Calendar,
        isActive: (p) => p.startsWith("/dashboard/booking/bookings"),
      });
    }

    // Business — only for business accounts. Personal accounts see the
    // "Switch to Business Account" CTA instead (rendered below the group).
    const business: NavItem[] = [];
    // Booking (the calendar/booking feature at /dashboard/booking) is shown to
    // every business account regardless of plan. Accounts without the
    // entitlement still see the entry; the page itself renders the workspace in a
    // locked state. The isActive check anchors on the exact path or a trailing
    // slash so the personal bookings list ("/dashboard/bookings") never lights
    // this item up.
    if (isBusiness && FEATURES.widgets) {
      business.push({
        href: "/dashboard/booking",
        label: "Booking",
        icon: CalendarDays,
        isActive: (p) => p === "/dashboard/booking" || p.startsWith("/dashboard/booking/"),
      });
    }
    if (isBusiness && FEATURES.brand) {
      business.push({
        href: "/dashboard/brand",
        label: "Brand",
        icon: Palette,
        isActive: (p) => p.startsWith("/dashboard/brand"),
      });
    }
    if (isBusiness && entitlements.hasAnalytics) {
      business.push({
        href: "/dashboard/analytics",
        label: t.nav.analytics,
        icon: BarChart3,
        isActive: (p) => p.startsWith("/dashboard/analytics"),
      });
    }

    // Settings
    const settings: NavItem[] = [
      {
        href: "/dashboard/settings",
        label: t.nav.settings,
        icon: Settings,
        isActive: (p) => p.startsWith("/dashboard/settings"),
      },
    ];
    if (FEATURES.monetization) {
      settings.push({
        href: "/dashboard/credits",
        label: "Subscription",
        icon: CreditCard,
        isActive: (p) => p.startsWith("/dashboard/credits"),
      });
    }
    if (entitlements.hasMcp) {
      settings.push({
        href: "/mcp",
        label: t.nav.mcp,
        icon: Plug,
        isActive: (p) => p.startsWith("/mcp"),
      });
    }

    const groups: NavGroup[] = [
      { id: "account", label: t.nav.groupAccount, items: account },
    ];
    // Skip the Shortcuts header entirely for personal accounts (empty group).
    if (shortcuts.length > 0) {
      groups.push({ id: "shortcuts", label: t.nav.groupShortcuts, items: shortcuts });
    }
    groups.push({ id: "business", label: t.nav.groupBusiness, items: business });
    groups.push({ id: "settings", label: t.nav.groupSettings, items: settings });
    return groups;
  }, [t, entitlements, isBusiness]);

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
              {userId && (
                <div className="flex items-center gap-0.5 shrink-0">
                  {flags.ai && <AiJobsIndicator userId={userId} />}
                  <NotificationBell userId={userId} />
                </div>
              )}
            </div>

            {/* View profile */}
            <Link
              href={username ? `/${username}` : "/dashboard/settings"}
              className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <User aria-hidden className="h-4 w-4 shrink-0" />
              <span className="truncate">{t.nav.viewProfile}</span>
            </Link>
          </div>
        )}
      </div>

      {/* Middle: nav — grouped Account / Business / Settings. Non-first groups
          carry a divider + top spacing so the sections stay legibly separated,
          including in the collapsed rail where the text headers are hidden. */}
      <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {navGroups.map((group, groupIndex) => (
          <div
            key={group.label}
            className={cn(
              "flex flex-col gap-0.5",
              groupIndex > 0 && "mt-2 pt-2 border-t border-sidebar-border/60"
            )}
          >
            {!collapsed ? (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2.5 pb-1">
                {group.label}
              </p>
            ) : (
              <span className="sr-only">{group.label}</span>
            )}
            {group.items.map((item) => {
              const active = item.isActive(pathname);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
                    collapsed && "justify-center"
                  )}
                >
                  <Icon aria-hidden className={cn("h-4 w-4 shrink-0", active && "text-violet-600")} strokeWidth={active ? 2.5 : 2} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}

            {/* Personal accounts see a CTA to upgrade into a Business account,
                which reveals the Widgets / Brand tools and hides Bookings. */}
            {group.id === "business" && userId && !isBusiness && (
              <button
                type="button"
                onClick={() => setSwitchOpen(true)}
                title={t.nav.switchToBusiness}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                  "text-violet-600 hover:bg-sidebar-accent",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  collapsed && "justify-center"
                )}
              >
                <Briefcase aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
                {!collapsed && <span className="truncate">{t.nav.switchToBusiness}</span>}
              </button>
            )}
          </div>
        ))}
      </nav>

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

      {/* Bottom: theme, logout */}
      <div className="border-t border-sidebar-border p-2 flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={mounted && theme === "dark" ? t.nav.switchLight : t.nav.switchDark}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed && "justify-center"
          )}
        >
          {mounted && theme === "dark" ? <Sun aria-hidden className="h-4 w-4 shrink-0" /> : <Moon aria-hidden className="h-4 w-4 shrink-0" />}
          {!collapsed && <span className="truncate">{mounted && theme === "dark" ? t.nav.switchLight : t.nav.switchDark}</span>}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          title={t.nav.logout}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed && "justify-center"
          )}
        >
          <LogOut aria-hidden className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate">{t.nav.logout}</span>}
        </button>
      </div>
    </aside>
  );
}
