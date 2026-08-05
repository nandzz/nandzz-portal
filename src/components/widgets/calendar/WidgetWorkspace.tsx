"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, CalendarDays, Users, UserCog, Settings, CircleAlert } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { SubscribeButton } from "@/components/widgets/SubscribeButton";
import { CalendarWidgetStudio } from "@/components/widgets/calendar/CalendarWidgetStudio";
import { StaffManager } from "@/components/widgets/calendar/StaffManager";
import { useCalendarConfig } from "@/components/widgets/calendar/useCalendarConfig";
import { WidgetOverview, type WidgetOverviewData } from "@/components/widgets/calendar/WidgetOverview";
import { WidgetBookings, type WidgetBookingsData } from "@/components/widgets/calendar/WidgetBookings";
import { WidgetCustomers, type WidgetCustomersData } from "@/components/widgets/calendar/WidgetCustomers";
import type { CalendarConfig, WidgetBooking } from "@/lib/types";

// Live-count new confirmed bookings whose start falls on "today" in the widget's
// timezone and is still upcoming. Subscribes to INSERTs on widget_bookings for
// this instance; RLS scopes delivery to the owner. Returns the running count,
// a reset(), and refreshes the server-rendered dashboard on each new booking.
function useNewBookingsToday(instanceId: string, timezone: string): [number, () => void] {
  const router = useRouter();
  const [newToday, setNewToday] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    // Same-day check anchored to the widget's IANA timezone (en-CA => YYYY-MM-DD).
    const dayFmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    // Coalesce bursts of inserts into a single server refresh.
    const scheduleRefresh = () => {
      if (refreshTimer.current) return;
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        router.refresh();
      }, 400);
    };

    const channel = supabase
      .channel(`widget_bookings:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "widget_bookings",
          filter: `instance_id=eq.${instanceId}`,
        },
        (payload) => {
          const row = payload.new as WidgetBooking;
          const now = Date.now();
          const startsMs = new Date(row.starts_at).getTime();
          const isTodayUpcoming =
            row.status === "confirmed" &&
            startsMs >= now &&
            dayFmt.format(new Date(startsMs)) === dayFmt.format(new Date(now));
          if (isTodayUpcoming) setNewToday((c) => c + 1);
          // Any new booking is relevant to the Bookings list / overview tiles.
          scheduleRefresh();
        }
      )
      .subscribe();

    return () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [instanceId, timezone, router]);

  const reset = useCallback(() => setNewToday(0), []);
  return [newToday, reset];
}

interface Props {
  instanceId: string;
  catalogId: string;
  hasAccess: boolean;
  enabled: boolean;
  config: CalendarConfig;
  overview: WidgetOverviewData;
  bookings: WidgetBookingsData;
  customers: WidgetCustomersData;
}

export function WidgetWorkspace({
  instanceId,
  catalogId,
  hasAccess,
  enabled,
  config,
  overview,
  bookings,
  customers,
}: Props) {
  const [tab, setTab] = useState("overview");
  // Single shared config controller — instantiated ONCE here so the Settings
  // studio (services + per-service staff_ids) and the Staff tab (config.staff)
  // edit and PATCH the same object instead of two divergent snapshots.
  const controller = useCalendarConfig(instanceId, config, enabled);
  // Badge subscription keys off the instance's initial timezone (stable across
  // config edits), matching the pre-refactor behavior.
  const [newToday, resetNewToday] = useNewBookingsToday(instanceId, config.timezone);

  const handleTabChange = useCallback(
    (value: unknown) => {
      const next = String(value);
      setTab(next);
      if (next === "bookings") resetNewToday();
    },
    [resetNewToday]
  );

  return (
    <Tabs value={tab} onValueChange={handleTabChange} className="gap-6">
      <TabsList variant="line" className="h-9">
        <TabsTrigger value="overview">
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </TabsTrigger>
        <TabsTrigger value="bookings">
          <CalendarDays className="h-4 w-4" /> Bookings
          {newToday > 0 && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {newToday}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="customers">
          <Users className="h-4 w-4" /> Customers
        </TabsTrigger>
        <TabsTrigger value="staff">
          <UserCog className="h-4 w-4" /> Staff
        </TabsTrigger>
        <TabsTrigger value="settings">
          <Settings className="h-4 w-4" /> Settings
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        {!hasAccess && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/50 dark:bg-orange-950/20 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-700 dark:text-orange-300">
              <CircleAlert className="h-4 w-4" /> This widget is hidden — subscribe to accept bookings.
            </span>
            <SubscribeButton catalogId={catalogId} label="Subscribe to activate" />
          </div>
        )}
        <WidgetOverview data={overview} />
      </TabsContent>

      <TabsContent value="bookings">
        <WidgetBookings data={bookings} />
      </TabsContent>

      <TabsContent value="customers">
        <WidgetCustomers data={customers} />
      </TabsContent>

      <TabsContent value="staff">
        <StaffManager controller={controller} />
      </TabsContent>

      <TabsContent value="settings">
        <CalendarWidgetStudio
          catalogId={catalogId}
          hasAccess={hasAccess}
          controller={controller}
        />
      </TabsContent>
    </Tabs>
  );
}
