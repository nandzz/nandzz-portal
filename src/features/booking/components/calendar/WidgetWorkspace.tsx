"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, Users, UserCog, MapPin, Clock, Tag, ChevronDown, ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { subscribeToWidgetBookings } from "@/features/booking/realtime";
import { AvailabilityManager } from "@/features/booking/components/calendar/AvailabilityManager";
import { ServicesManager } from "@/features/booking/components/calendar/ServicesManager";
import { StaffManager } from "@/features/booking/components/calendar/StaffManager";
import { LocationManager } from "@/features/booking/components/calendar/LocationManager";
import { LocationGate } from "@/features/booking/components/calendar/LocationGate";
import { useCalendarConfig } from "@/features/booking/components/calendar/useCalendarConfig";
import { WidgetOverview } from "@/features/booking/components/calendar/WidgetOverview";
import { WidgetBookings } from "@/features/booking/components/calendar/WidgetBookings";
import { WidgetCustomers } from "@/features/booking/components/calendar/WidgetCustomers";
import { NewBookingBanner } from "@/features/booking/components/calendar/NewBookingBanner";
import { useWidgetDashboard, type InitialDashboard } from "@/features/booking/components/calendar/useWidgetDashboard";
import { playBookingChime } from "@/features/booking/chime";
import { tabFromSegment, segmentFromTab } from "@/features/booking/widgetTabs";
import type { CalendarConfig, WidgetBooking } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

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
  onRefresh: () => void,
  onConfirmedBooking?: (booking: WidgetBooking) => void
): [number, () => void] {
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
        onRefresh();
      }, 400);
    };

    const unsubscribe = subscribeToWidgetBookings(instanceId, {
      onInsert: (row) => {
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
      },
    });

    return () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      unsubscribe();
    };
  }, [instanceId, timezone, onRefresh]);

  const reset = useCallback(() => setNewToday(0), []);
  return [newToday, reset];
}

interface Props {
  instanceId: string;
  enabled: boolean;
  config: CalendarConfig;
  initial: InitialDashboard;
  currencySymbol: string;
  shareUrl: string | null;
  initialTab: string;
  // Dashboard base path this workspace is mounted at (e.g. "/dashboard/booking").
  // Tab segments hang off it (`${basePath}/{segment}`); no instance id in the URL
  // since booking is a single per-owner feature surface.
  basePath: string;
}

export function WidgetWorkspace({
  instanceId,
  enabled,
  config,
  initial,
  currencySymbol,
  shareUrl,
  initialTab,
  basePath,
}: Props) {
  const { t } = useLanguage();
  const pathname = usePathname();
  // The active tab lives in the URL path (`${basePath}/{segment}`), resolved
  // server-side into `initialTab` for the first render / deep links. We keep it
  // in local state (so switching is instant and never remounts the workspace,
  // preserving unsaved config edits + the realtime subscription) and sync it
  // back from the path when the owner uses the browser back/forward buttons.
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    // The tab is the first segment after basePath (absent on the base/overview
    // path).
    const rel = pathname.startsWith(basePath) ? pathname.slice(basePath.length).replace(/^\//, "") : "";
    const next = tabFromSegment(rel.split("/")[0] || undefined) ?? "overview";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync tab to the URL on back/forward (external-state sync, not derived render state)
    setTab((prev) => (prev === next ? prev : next));
  }, [pathname, basePath]);
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
    } else if (locations.length === 1) {
      // A single location has nothing to choose — skip the gate and open its
      // dashboard straight away. Switching (via the header pill) still shows the
      // gate, so "Gestisci sedi" stays reachable.
      setSelectedLocationId(locations[0].id);
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

  // All tab data is fetched windowed/aggregated server-side, scoped to the
  // current location, and refetched on demand as the owner navigates — see
  // useWidgetDashboard. Seeded from the loader's first-paint payload.
  const dash = useWidgetDashboard({ instanceId, initial, locationId: currentLocationId, shareUrl });

  // Realtime + manual bookings refresh the visible slices in place (no full
  // navigation): the badge subscription drives dash.refetchAll on every insert.
  const [newToday, resetNewToday] = useNewBookingsToday(
    instanceId,
    config.timezone,
    dash.refetchAll,
    handleConfirmedBooking
  );

  // Stable "now" anchor for the children's chronological tags across this mount.
  const [now] = useState(() => Date.now());

  // Inputs for the owner's manual "New booking" flow, scoped to the current
  // location (or the legacy top-level config when the instance has no
  // locations). `locationId` matches how the dashboard data is scoped, so a
  // manual booking lands under the location the owner is viewing.
  const manualBookingScope = useMemo(
    () =>
      currentLocation
        ? {
            instanceId,
            locationId: currentLocation.id,
            services: currentLocation.services,
            categories: currentLocation.categories ?? [],
            staff: currentLocation.staff,
            showPrices: controller.config.show_prices,
          }
        : {
            instanceId,
            locationId: null,
            services: controller.config.services,
            categories: controller.config.categories ?? [],
            staff: controller.config.staff,
            showPrices: controller.config.show_prices,
          },
    [currentLocation, instanceId, controller.config]
  );

  const handleTabChange = useCallback(
    (value: unknown) => {
      const next = String(value);
      setTab(next);
      if (next === "bookings") resetNewToday();
      // Reflect the tab in the URL without a navigation/refetch: pushState
      // integrates with the Next router (keeps usePathname in sync) while
      // leaving this component mounted, so switching tabs never drops unsaved
      // config edits or resubscribes realtime. pushState (not replaceState) so
      // the browser back button steps through visited tabs.
      window.history.pushState(null, "", `${basePath}/${segmentFromTab(next)}`);
    },
    [resetNewToday, basePath]
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
          <LocationManager controller={controller} onFirstLocationCreated={pickLocation} />
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
          {/* On narrow screens inactive tabs collapse to icon-only (the active tab
              keeps its label) so the row fits without scrolling horizontally. */}
          <div className="w-full min-w-0 sm:w-auto">
            <TabsList variant="line" className="h-9 w-full sm:w-max">
              <TabsTrigger value="overview">
                <LayoutDashboard className="h-4 w-4" /> <TabLabel>{t.booking.tabDashboard}</TabLabel>
              </TabsTrigger>
              <TabsTrigger value="bookings">
                <CalendarDays className="h-4 w-4" /> <TabLabel>{t.booking.tabBookings}</TabLabel>
                {newToday > 0 && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {newToday}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="customers">
                <Users className="h-4 w-4" /> <TabLabel>{t.booking.tabCustomers}</TabLabel>
              </TabsTrigger>
              <TabsTrigger value="staff">
                <UserCog className="h-4 w-4" /> <TabLabel>{t.booking.staffSectionTitle}</TabLabel>
              </TabsTrigger>
              <TabsTrigger value="availability">
                <Clock className="h-4 w-4" /> <TabLabel>{t.booking.tabAvailability}</TabLabel>
              </TabsTrigger>
              <TabsTrigger value="services">
                <Tag className="h-4 w-4" /> <TabLabel>{t.booking.tabServices}</TabLabel>
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
          <WidgetOverview data={dash.overview} period={dash.period} onPeriodChange={dash.setPeriod} />
        </TabsContent>

        <TabsContent value="bookings">
          <WidgetBookings
            timezone={effectiveTimezone}
            currencySymbol={currencySymbol}
            now={now}
            calendar={dash.calendar}
            monthKey={dash.monthKey}
            onMonthChange={dash.setMonthKey}
            calendarLoading={dash.calendarLoading}
            list={dash.list}
            page={dash.page}
            onPageChange={dash.setPage}
            listLoading={dash.listLoading}
            filter={dash.filter}
            onFilterChange={dash.setFilter}
            query={dash.query}
            onQueryChange={dash.setQuery}
            manual={manualBookingScope}
            onBooked={dash.refetchAll}
          />
        </TabsContent>

        <TabsContent value="customers">
          <WidgetCustomers data={dash.customers} instanceId={instanceId} locationId={currentLocationId} />
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
      </Tabs>
      {bookingBanner}
    </>
  );
}

/** Tab label visually hidden on mobile (still read by screen readers) unless its trigger is active. */
function TabLabel({ children }: { children: ReactNode }) {
  return <span className="sr-only sm:not-sr-only in-data-active:not-sr-only">{children}</span>;
}
