"use client";

import { useEffect, useState, useCallback, useId, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Notification } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchNotifications, subscribeToNotifications } from "../realtime";
import { markNotificationsRead } from "../actions/mark-notifications-read";

type Locale = ReturnType<typeof useLanguage>["locale"];
type T = ReturnType<typeof useLanguage>["t"];

function relativeTime(dateStr: string, locale: Locale): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "minute");
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function appointmentTime(startsAt: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(startsAt));
  } catch {
    return "";
  }
}

// Fills a "{name} … {title}" template, bolding each substituted value.
function fill(template: string, vars: Record<string, string>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = part.match(/^\{(\w+)\}$/)?.[1];
    if (key && vars[key] != null) {
      return (
        <span key={i} className="font-semibold text-foreground">
          {vars[key]}
        </span>
      );
    }
    return part;
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + second).toUpperCase();
}

const KIND_STYLE = {
  booking: { icon: CalendarDays, tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300", badge: "bg-emerald-500" },
  ai: { icon: Sparkles, tint: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300", badge: "bg-violet-500" },
} as const;

interface NotificationView {
  kind: keyof typeof KIND_STYLE;
  // Person the notification is about; null for system events (AI edits).
  actor: string | null;
  text: ReactNode[];
  detail: ReactNode;
}

function describe(n: Notification, t: T, locale: Locale): NotificationView {
  switch (n.type) {
    case "ai_edit_ready": {
      const { space_title, instruction } = n.payload as { space_title: string; instruction?: string };
      return {
        kind: "ai",
        actor: null,
        text: fill(t.notifications.aiEditReady, { title: space_title }),
        detail: instruction ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">{instruction}</p>
        ) : null,
      };
    }
    case "new_booking": {
      const { customer_name, service_name, starts_at } = n.payload as {
        customer_name: string;
        service_name: string;
        starts_at?: string;
      };
      const when = starts_at ? appointmentTime(starts_at, locale) : "";
      return {
        kind: "booking",
        actor: customer_name,
        text: fill(t.notifications.newBooking, { name: customer_name, service: service_name }),
        detail: when ? (
          <span className="inline-flex w-fit items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-400/20">
            <Clock className="h-3 w-3" />
            {when}
          </span>
        ) : null,
      };
    }
  }
}

function NotificationAvatar({ view }: { view: NotificationView }) {
  const style = KIND_STYLE[view.kind];
  const Icon = style.icon;
  if (!view.actor) {
    return (
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", style.tint)}>
        <Icon className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="relative h-9 w-9 shrink-0">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold",
          style.tint
        )}
      >
        {initials(view.actor)}
      </span>
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-white ring-2 ring-popover",
          style.badge
        )}
      >
        <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
      </span>
    </span>
  );
}

interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  // Unique per mount so multiple instances (e.g. Navbar + Sidebar) don't
  // collide on the same realtime topic.
  const instanceId = useId();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  // Opening the menu marks everything read; remember what was unread at that
  // moment so those rows stay highlighted while the menu is open.
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());

  const loadNotifications = useCallback(async () => {
    const data = await fetchNotifications(userId);
    setNotifications(data);
    setUnreadCount(data.filter((n) => !n.read_at).length);
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount data load; setState fires after the awaited fetch, not synchronously
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    return subscribeToNotifications(userId, instanceId, {
      onInsert: (n) => {
        setNotifications((prev) => [n, ...prev].slice(0, 20));
        setUnreadCount((c) => c + 1);
      },
    });
  }, [userId, instanceId]);

  const markAllRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (!unreadIds.length) return;
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (unreadIds.includes(n.id) ? { ...n, read_at: now } : n))
    );
    setUnreadCount(0);
    await markNotificationsRead(unreadIds);
  }, [notifications]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setFreshIds(new Set(notifications.filter((n) => !n.read_at).map((n) => n.id)));
      markAllRead();
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-0.5 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(23rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{t.notifications.title}</h3>
          {freshIds.size > 0 && (
            <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
              {freshIds.size > 9 ? "9+" : freshIds.size}
            </span>
          )}
        </div>
        <div className="max-h-[440px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </span>
              <p className="text-sm text-muted-foreground">{t.notifications.empty}</p>
            </div>
          ) : (
            notifications.map((n) => {
              const view = describe(n, t, locale);
              const fresh = freshIds.has(n.id) || !n.read_at;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (n.type === "new_booking") {
                      // Booking is a single per-owner feature now, so the received
                      // appointments live at a fixed path (no instance id).
                      router.push("/dashboard/booking/bookings");
                      setOpen(false);
                      return;
                    }
                    const { space_owner_username, space_id } = n.payload as {
                      space_owner_username: string;
                      space_id: string;
                    };
                    router.push(`/${space_owner_username}/space/${space_id}`);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent/70 focus-visible:bg-accent/70 focus-visible:outline-none",
                    fresh && "bg-violet-50/60 dark:bg-violet-950/20"
                  )}
                >
                  <NotificationAvatar view={view} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <p className="text-[13px] leading-snug text-foreground/80">{view.text}</p>
                    {view.detail}
                    <p className="text-[11px] text-muted-foreground">{relativeTime(n.created_at, locale)}</p>
                  </div>
                  {fresh && (
                    <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-600" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
