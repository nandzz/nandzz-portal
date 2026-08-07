"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, CalendarDays, Users, UserCog, MapPin, Clock, Tag, Bell, CircleAlert, ChevronDown, ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { SubscribeButton } from "@/components/widgets/SubscribeButton";
import { AvailabilityManager } from "@/components/widgets/calendar/AvailabilityManager";
import { ServicesManager } from "@/components/widgets/calendar/ServicesManager";
import { NotificationsManager } from "@/components/widgets/calendar/NotificationsManager";
import { StaffManager } from "@/components/widgets/calendar/StaffManager";
import { LocationManager } from "@/components/widgets/calendar/LocationManager";
import { LocationGate } from "@/components/widgets/calendar/LocationGate";
import { useCalendarConfig } from "@/components/widgets/calendar/useCalendarConfig";
import { WidgetOverview } from "@/components/widgets/calendar/WidgetOverview";
import { WidgetBookings } from "@/components/widgets/calendar/WidgetBookings";
import { WidgetCustomers } from "@/components/widgets/calendar/WidgetCustomers";
import { NewBookingBanner } from "@/components/widgets/calendar/NewBookingBanner";
import { buildOverview, buildBookings, buildCustomers } from "@/lib/widgets/calendarStats";
import { playBookingChime } from "@/lib/widgets/chime";
import type { CalendarConfig, WidgetBooking } from "@/lib/types";
import type { StatsPeriod } from "@/lib/period";
import { useLanguage } from "@/contexts/LanguageContext";

const VALID_TABS = new Set([
  "overview",
  "bookings",
  "customers",
  "staff",
  "availability",
  "services",
  "notifications",
]);

// Live-count new confirmed bookings whose start falls on "today" in the widget's
// timezone and is still upcoming. Subscribes to INSERTs on widget_bookings for
// this instance; RLS scopes delivery to the owner. Returns the running count,
// a reset(), and refreshes the server-rendered dashboard on each new booking.
// `onConfirmedBooking` reuses this same subscription to surface every new
// confirmed booking (not just "today") to the caller for a chime + banner —
// deliberately not a second realtime channel on the same table/filter.
function useNewBookingsToday(
  instanceId: string,
  timezone: string,
  onConfirmedBooking?: (booking: WidgetBooking) => void
): [number, () => void] {
  const router = useRouter();
  const [newToday, setNewToday] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref so the effect below doesn't need to resubscribe when the callback
  // identity changes across renders. Updated in an effect (not during
  // render) since writing a ref while rendering isn't allowed.
  const onConfirmedBookingRef = useRef(onConfirmedBooking);
  useEffect(() => {
    onConfirmedBookingRef.current = onConfirmedBooking;
  }, [onConfirmedBooking]);

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
          if (row.status === "confirmed") onConfirmedBookingRef.current?.(row);
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
  allBookings: WidgetBooking[];
  currencySymbol: string;
  shareUrl: string | null;
  locale: string;
}

export function WidgetWorkspace({
  instanceId,
  catalogId,
  hasAccess,
  enabled,
  config,
  allBookings,
  currencySymbol,
  shareUrl,
  locale,
}: Props) {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  // Deep-link support: `?tab=bookings` opens straight to the Bookings tab
  // (used by the notification-bell entry). Read once on mount; anything
  // absent/unrecognized falls back to "overview".
  const [tab, setTab] = useState(() => {
    const requested = searchParams.get("tab");
    return requested && VALID_TABS.has(requested) ? requested : "overview";
  });
  // Single shared config controller — instantiated ONCE here so the Settings
  // studio (services + per-service staff_ids) and the Staff tab (config.staff)
  // edit and PATCH the same object instead of two divergent snapshots.
  const controller = useCalendarConfig(instanceId, config, enabled);

  // Single live booking alert (chime + banner) — stays on screen until the
  // owner dismisses it or another booking arrives and replaces it. No
  // auto-dismiss timer: a booking notification shouldn't disappear unseen.
  const [bookingAlert, setBookingAlert] = useState<WidgetBooking | null>(null);
  const handleConfirmedBooking = useCallback((booking: WidgetBooking) => {
    setBookingAlert(booking);
    // Sound only while the owner is actually looking at this tab; a
    // backgrounded tab relies on the notification-bell entry instead.
    playBookingChime();
  }, []);
  const dismissBookingAlert = useCallback(() => {
    setBookingAlert(null);
  }, []);

  // Badge subscription keys off the instance's initial timezone (stable across
  // config edits), matching the pre-refactor behavior.
  const [newToday, resetNewToday] = useNewBookingsToday(instanceId, config.timezone, handleConfirmedBooking);

  // Which location the Staff tab and the Settings studio's Services/
  // Availability sections are scoped to — shared here so both stay in sync.
  // `selectedLocationId` only records an explicit pick; `currentLocationId` is
  // derived at render time so it's always valid (falls back to the first
  // location when nothing/something stale is selected).
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const locations = controller.config.locations;
  const currentLocationId =
    selectedLocationId && locations.some((l) => l.id === selectedLocationId)
      ? selectedLocationId
      : locations[0]?.id ?? null;

  // Opening a widget is a strict two-step flow: pick (or create) a location,
  // then that location's dashboard — every tab in the dashboard is scoped to
  // it. Locations are managed here too (create/edit/delete), not as a tab
  // inside the dashboard, so the dashboard never needs a "no location" state.
  const locationStorageKey = `widget:${instanceId}:locationId`;
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [mode, setMode] = useState<"pick" | "manage">("pick");

  useEffect(() => {
    // localStorage isn't available during SSR, so server and client both
    // start ungated; this restores the last pick right after mount, trading
    // a one-frame flip for zero hydration mismatch (mirrors AppChrome's
    // sidebar-collapse restore effect).
    const stored = window.localStorage.getItem(locationStorageKey);
    if (stored && locations.some((l) => l.id === stored)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedLocationId(stored);
      setLocationConfirmed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickLocation(id: string) {
    setSelectedLocationId(id);
    window.localStorage.setItem(locationStorageKey, id);
    setLocationConfirmed(true);
    setMode("pick");
  }

  // Overview/Bookings/Customers are recomputed per selected location — a
  // customer only shows up under the location(s) they've actually booked
  // through, since create_booking_tx snapshots location_id onto every row.
  const currentLocation = locations.find((l) => l.id === currentLocationId) ?? null;
  const effectiveTimezone = currentLocation?.timezone || controller.config.timezone;

  const scopedBookings = useMemo(
    () => allBookings.filter((b) => b.location_id === currentLocationId),
    [allBookings, currentLocationId]
  );
  const [trendPeriod, setTrendPeriod] = useState<StatsPeriod>("month");
  const overview = useMemo(
    () => buildOverview(scopedBookings, effectiveTimezone, currencySymbol, shareUrl, locale, trendPeriod),
    [scopedBookings, effectiveTimezone, currencySymbol, shareUrl, locale, trendPeriod]
  );
  const bookingsData = useMemo(
    () => buildBookings(scopedBookings, effectiveTimezone, currencySymbol),
    [scopedBookings, effectiveTimezone, currencySymbol]
  );
  const customersData = useMemo(
    () => buildCustomers(scopedBookings, effectiveTimezone, currencySymbol),
    [scopedBookings, effectiveTimezone, currencySymbol]
  );

  const handleTabChange = useCallback(
    (value: unknown) => {
      const next = String(value);
      setTab(next);
      if (next === "bookings") resetNewToday();
    },
    [resetNewToday]
  );

  // Clicking the banner jumps straight to the Bookings tab and clears the
  // alert (the badge count still tracks "today" separately via resetNewToday).
  const handleOpenBookingAlert = useCallback(() => {
    handleTabChange("bookings");
    dismissBookingAlert();
  }, [handleTabChange, dismissBookingAlert]);

  const bookingBanner = (
    <NewBookingBanner
      booking={bookingAlert}
      timezone={effectiveTimezone}
      onOpen={handleOpenBookingAlert}
      onDismiss={dismissBookingAlert}
    />
  );

  if (!locationConfirmed) {
    // Zero locations ⇒ the empty state below IS the "create a locale" prompt.
    // Browsing to "manage" from the picker reuses the same full roster view.
    if (locations.length === 0 || mode === "manage") {
      return (
        <div className="space-y-4">
          {locations.length > 0 && (
            <button
              type="button"
              onClick={() => setMode("pick")}
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> {t.booking.backToLocations}
            </button>
          )}
          <LocationManager controller={controller} />
          {bookingBanner}
        </div>
      );
    }
    return (
      <>
        <LocationGate locations={locations} onSelect={pickLocation} onManage={() => setMode("manage")} />
        {bookingBanner}
      </>
    );
  }

  return (
    <>
      <Tabs value={tab} onValueChange={handleTabChange} className="gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Horizontally scrollable on narrow screens so 7 tabs never overflow
              or force the row to wrap mid-list. */}
          <div className="min-w-0 max-w-full overflow-x-auto">
            <TabsList variant="line" className="h-9 w-max">
              <TabsTrigger value="overview">
                <LayoutDashboard className="h-4 w-4" /> {t.booking.tabDashboard}
              </TabsTrigger>
              <TabsTrigger value="bookings">
                <CalendarDays className="h-4 w-4" /> {t.booking.tabBookings}
                {newToday > 0 && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {newToday}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="customers">
                <Users className="h-4 w-4" /> {t.booking.tabCustomers}
              </TabsTrigger>
              <TabsTrigger value="staff">
                <UserCog className="h-4 w-4" /> {t.booking.staffSectionTitle}
              </TabsTrigger>
              <TabsTrigger value="availability">
                <Clock className="h-4 w-4" /> {t.booking.tabAvailability}
              </TabsTrigger>
              <TabsTrigger value="services">
                <Tag className="h-4 w-4" /> {t.booking.tabServices}
              </TabsTrigger>
              <TabsTrigger value="notifications">
                <Bell className="h-4 w-4" /> {t.booking.tabNotifications}
              </TabsTrigger>
            </TabsList>
          </div>

          <button
            type="button"
            onClick={() => {
              setLocationConfirmed(false);
              setMode("pick");
            }}
            aria-label={t.booking.switchLocationAria}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"
          >
            <MapPin className="h-3.5 w-3.5" />
            {t.booking.currentLocationPillLabel.replace("{name}", currentLocation?.name || t.booking.unnamedLocation)}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <TabsContent value="overview">
          {!hasAccess && (
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/50 dark:bg-orange-950/20 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-700 dark:text-orange-300">
                <CircleAlert className="h-4 w-4" /> {t.booking.widgetHiddenNotice}
              </span>
              <SubscribeButton catalogId={catalogId} label={t.booking.subscribeToActivate} />
            </div>
          )}
          <WidgetOverview data={overview} period={trendPeriod} onPeriodChange={setTrendPeriod} />
        </TabsContent>

        <TabsContent value="bookings">
          <WidgetBookings data={bookingsData} />
        </TabsContent>

        <TabsContent value="customers">
          <WidgetCustomers data={customersData} />
        </TabsContent>

        <TabsContent value="staff">
          <StaffManager controller={controller} currentLocationId={currentLocationId} />
        </TabsContent>

        <TabsContent value="availability">
          <AvailabilityManager controller={controller} currentLocationId={currentLocationId} />
        </TabsContent>

        <TabsContent value="services">
          <ServicesManager controller={controller} currentLocationId={currentLocationId} />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsManager controller={controller} />
        </TabsContent>
      </Tabs>
      {bookingBanner}
    </>
  );
}
