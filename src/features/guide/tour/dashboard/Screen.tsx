"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { CalendarDays, ChevronDown, Clock, LayoutDashboard, MapPin, Settings, Sun, Users, UserCog, Tag } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { EASE_OUT, useReduceMotion } from "@/features/home";
import { WidgetToday } from "@/features/booking/components/calendar/today/WidgetToday";
import { WidgetOverview } from "@/features/booking/components/calendar/WidgetOverview";
import { WidgetBookings, type ManualBookingScope } from "@/features/booking/components/calendar/WidgetBookings";
import { WidgetCustomers } from "@/features/booking/components/calendar/WidgetCustomers";
import type { StaffMember } from "@/lib/types";
import type { TourScreenProps } from "../types";
import { buildBookings, buildCustomers, buildOverview, buildToday, tourNow, tourTimezone, TOUR_STAFF } from "./data";
import { stepTab, type DashboardTab } from "./steps";

const noop = () => {};

// How far each step scrolls its tab: to the agenda + customer panel (Today), or
// to the occupancy + forecast cards (Dashboard). Resolved from the real DOM so
// it holds at any frame width.
function anchorFor(step: number, root: HTMLElement): HTMLElement | null {
  if (step === 1) return root.querySelector("section[aria-labelledby]")?.parentElement ?? null;
  if (step === 3) return (root.firstElementChild?.lastElementChild as HTMLElement | null) ?? null;
  return null;
}

// The /dashboard/booking page, built from the real page header + tab bar and
// the real tab components, fed sample data for Studio Lume.
export default function DashboardScreen({ step }: TourScreenProps) {
  const { t } = useLanguage();
  const reduce = useReduceMotion();
  const tab = stepTab(step);

  const contentRef = useRef<HTMLDivElement>(null);
  const [y, setY] = useState(0);
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => {
      const inner = el.firstElementChild as HTMLElement | null;
      const anchor = inner ? anchorFor(step, inner) : null;
      const max = Math.max(0, el.scrollHeight - (el.parentElement?.clientHeight ?? 0));
      setY(anchor ? Math.min(max, Math.max(0, anchor.offsetTop - 4)) : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step, tab]);

  return (
    <div className="flex h-full flex-col px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
            <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{t.mobileTab.booking}</h1>
            <p className="truncate text-sm text-muted-foreground">{t.booking.liveOnProfile}</p>
          </div>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground">
          <Settings className="h-4 w-4" />
        </span>
      </div>

      <Tabs value={tab} className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="w-full min-w-0 sm:w-auto">
            <TabsList variant="line" className="h-9 w-full sm:w-max">
              <TabsTrigger value="today">
                <Sun className="h-4 w-4" /> <TabLabel>{t.bookingToday.tab}</TabLabel>
              </TabsTrigger>
              <TabsTrigger value="overview">
                <LayoutDashboard className="h-4 w-4" /> <TabLabel>{t.booking.tabDashboard}</TabLabel>
              </TabsTrigger>
              <TabsTrigger value="bookings">
                <CalendarDays className="h-4 w-4" /> <TabLabel>{t.booking.tabBookings}</TabLabel>
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
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 text-xs font-medium text-emerald-700 md:inline-flex dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
            <MapPin className="h-3.5 w-3.5" />
            {t.booking.currentLocationPillLabel.replace("{name}", "Studio Lume")}
            <ChevronDown className="h-3.5 w-3.5" />
          </span>
        </div>
      </Tabs>

      {/* The tab's content, scrolled to the part the step is about */}
      <div className="relative mt-4 min-h-0 flex-1 overflow-hidden">
        <motion.div
          ref={contentRef}
          animate={{ transform: `translateY(${-y}px)` }}
          transition={{ duration: reduce ? 0 : 0.7, ease: EASE_OUT }}
        >
          <motion.div
            key={tab}
            className="relative pb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduce ? 0 : 0.3, ease: EASE_OUT }}
          >
            <TabBody tab={tab} />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

function TabBody({ tab }: { tab: DashboardTab }) {
  const { t, locale } = useLanguage();
  const sample = t.guidePage.tour.sample;
  const now = useMemo(() => tourNow(), []);
  const timezone = useMemo(() => tourTimezone(), []);

  const today = useMemo(() => buildToday(now, sample), [now, sample]);
  const overview = useMemo(() => buildOverview(now, locale, sample), [now, locale, sample]);
  const bookings = useMemo(() => buildBookings(now, sample), [now, sample]);
  const customers = useMemo(() => buildCustomers(now), [now]);

  // The booking list only needs to know there is staff (it unlocks the row actions).
  const manual = useMemo<ManualBookingScope>(
    () => ({
      instanceId: "tour-instance",
      locationId: null,
      services: [],
      categories: [],
      staff: TOUR_STAFF.map((s) => ({ id: s.id, name: s.name, availability: {} }) as StaffMember),
      showPrices: true,
    }),
    []
  );

  switch (tab) {
    case "today":
      return <WidgetToday data={today} loading={false} />;
    case "overview":
      return <WidgetOverview data={overview} period="month" onPeriodChange={noop} />;
    case "bookings":
      return (
        <WidgetBookings
          timezone={timezone}
          currencySymbol="€"
          now={now}
          calendar={bookings.calendar}
          monthKey={bookings.calendar.monthKey}
          onMonthChange={noop}
          calendarLoading={false}
          list={bookings.list}
          page={0}
          onPageChange={noop}
          listLoading={false}
          filter="all"
          onFilterChange={noop}
          query=""
          onQueryChange={noop}
          manual={manual}
          onBooked={noop}
        />
      );
    case "customers":
      return <WidgetCustomers data={customers} instanceId="tour-instance" locationId={null} />;
  }
}

/** Same as the real workspace: inactive tabs collapse to icons on narrow widths. */
function TabLabel({ children }: { children: ReactNode }) {
  return <span className="sr-only sm:not-sr-only in-data-active:not-sr-only">{children}</span>;
}
