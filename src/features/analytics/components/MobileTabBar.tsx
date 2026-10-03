"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BarChart3, Home, LayoutGrid, LogIn, Rss, Calendar, CalendarDays, User } from "lucide-react";
import { FEATURES } from "@/lib/flags";
import { useLanguage } from "@/contexts/LanguageContext";
import { useChrome } from "@/contexts/ChromeContext";
import { useAuth } from "../AuthContext";

type TabDef = {
  href: string;
  labelKey: string;
  icon: React.ElementType;
  isActive: (pathname: string) => boolean;
};

const UNAUTH_TAB_DEFS: TabDef[] = [
  { href: "/", labelKey: "home", icon: Home, isActive: (p) => p === "/" },
  { href: "/login", labelKey: "signIn", icon: LogIn, isActive: (p) => p.startsWith("/login") },
];

// Content tab: active on any /dashboard/contents route (including the create
// flow, which is reached from the Content page's own button, not a tab).
const spacesTab: TabDef = {
  href: "/dashboard/contents",
  labelKey: "spaces",
  icon: LayoutGrid,
  isActive: (p) => p.startsWith("/dashboard/contents"),
};

// A business's bookings live inside the calendar widget, so /dashboard/bookings
// server-redirects them to this sub-route. The tab bar must still read that as
// "Bookings" (not "Widgets"), hence the shared matcher below.
const WIDGET_BOOKINGS = /^\/dashboard\/booking\/bookings/;

// Bookings is a first-class destination for both personas — the whole product is
// "get found & booked", so appointments belong in the thumb zone, not nested in a
// drop-up. For a business these are received appointments; for a client, their own.
const bookingsTab: TabDef = {
  href: "/dashboard/bookings",
  labelKey: "bookings",
  icon: Calendar,
  isActive: (p) => p.startsWith("/dashboard/bookings") || WIDGET_BOOKINGS.test(p),
};

// Persona-tuned bottom bar — a few frequent destinations only. Followers/Following
// live on the profile (tappable counts), so they're not tabs; Brand lives in the
// account menu. A business runs the operation; a client consumes and manages their
// own page.
function getAuthTabDefs(isBusiness: boolean, profileHref: string): TabDef[] {
  const profileTab: TabDef = { href: profileHref, labelKey: "profile", icon: User, isActive: (p) => p === profileHref };

  if (isBusiness) {
    // No Home tab: "/" just redirects a signed-in user to their profile, which
    // already has its own tab. No Bookings tab either: a business's received
    // appointments live inside the Booking feature (/dashboard/bookings
    // redirects there), so the Booking tab covers them.
    const tabs: TabDef[] = [
      { href: "/dashboard/analytics", labelKey: "analytics", icon: BarChart3, isActive: (p) => p.startsWith("/dashboard/analytics") },
    ];
    if (FEATURES.widgets) {
      tabs.push({
        href: "/dashboard/booking",
        labelKey: "booking",
        icon: CalendarDays,
        isActive: (p) => p === "/dashboard/booking" || p.startsWith("/dashboard/booking/") || p.startsWith("/dashboard/bookings"),
      });
    }
    tabs.push(spacesTab, profileTab);
    return tabs;
  }

  return [
    { href: "/dashboard/feed", labelKey: "feed", icon: Rss, isActive: (p) => p.startsWith("/dashboard/feed") },
    spacesTab,
    bookingsTab,
    profileTab,
  ];
}

// Shared tab visual.
function tabInner(Icon: React.ElementType, label: string, active: boolean) {
  return (
    <>
      <Icon
        className={cn("h-5 w-5 shrink-0 transition-colors", active ? "text-violet-600" : "text-muted-foreground")}
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
    </>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { isHidden } = useChrome();
  const { userId, profile } = useAuth();

  const isBusiness = profile?.account_type === "business";
  // Mirror the top-bar avatar's target: public profile once a username exists,
  // settings during onboarding.
  const profileHref = profile?.username ? `/${profile.username}` : "/dashboard/settings";
  const tabDefs = userId ? getAuthTabDefs(isBusiness, profileHref) : UNAUTH_TAB_DEFS;

  const tabClass = "flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-2";

  return (
    <nav
      aria-hidden={isHidden}
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden border-t bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80",
        "transition-transform duration-300 ease-out motion-reduce:transition-none will-change-transform",
        isHidden && "translate-y-full pointer-events-none"
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-16 items-center justify-around px-1">
        {tabDefs.map((tab) => {
          const active = tab.isActive(pathname);
          const label = t.mobileTab[tab.labelKey as keyof typeof t.mobileTab];

          return (
            <Link key={tab.href} href={tab.href} className={cn(tabClass, "transition-transform active:scale-95")}>
              {tabInner(tab.icon, label, active)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
