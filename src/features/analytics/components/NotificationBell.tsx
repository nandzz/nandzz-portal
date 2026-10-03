"use client";

import { useEffect, useState, useCallback, useId } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
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

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface NotificationBellProps {
  userId: string;
}

function notificationText(n: Notification, t: ReturnType<typeof useLanguage>["t"]): string {
  switch (n.type) {
    case "ai_edit_ready": {
      const { space_title } = n.payload as { space_title: string };
      return t.notifications.aiEditReady.replace("{title}", space_title);
    }
    case "new_comment":
    case "new_reply":
    case "comment_mention": {
      const { space_title, commenter_display_name, commenter_username } = n.payload as {
        space_title: string;
        commenter_display_name: string | null;
        commenter_username: string;
      };
      const name = commenter_display_name || commenter_username;
      const key =
        n.type === "new_comment" ? "newComment" : n.type === "new_reply" ? "newReply" : "mention";
      return t.notifications[key].replace("{name}", name).replace("{title}", space_title);
    }
    case "new_booking": {
      const { customer_name, service_name } = n.payload as { customer_name: string; service_name: string };
      return t.notifications.newBooking.replace("{name}", customer_name).replace("{service}", service_name);
    }
  }
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter();
  const { t } = useLanguage();
  // Unique per mount so multiple instances (e.g. Navbar + Sidebar) don't
  // collide on the same realtime topic.
  const instanceId = useId();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

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
    if (isOpen) markAllRead();
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
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{t.notifications.title}</h3>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t.notifications.empty}</p>
            </div>
          ) : (
            notifications.map((n) => (
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
                  const isComment = n.type === "new_comment" || n.type === "new_reply" || n.type === "comment_mention";
                  const suffix = isComment ? "?comments=open" : "";
                  const { space_owner_username, space_id } = n.payload as {
                    space_owner_username: string;
                    space_id: string;
                  };
                  router.push(`/${space_owner_username}/space/${space_id}${suffix}`);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent",
                  !n.read_at && "bg-violet-50/60 dark:bg-violet-950/20"
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.read_at && (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-600" />
                  )}
                  <div className={cn("flex flex-col gap-0.5", !n.read_at ? "" : "pl-3.5")}>
                    <p className="text-xs leading-snug">{notificationText(n, t)}</p>
                    <p className="text-[11px] text-muted-foreground">{relativeTime(n.created_at)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
