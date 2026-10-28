"use client";

import { useMemo, type ReactNode } from "react";
import { CalendarDays, Check, ChevronRight, Clock, LayoutDashboard, MapPin, ChevronDown, Settings, Sun, Tag, UserCog, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";
import { todayInZone } from "@/features/booking/domain/calendar";
import { useCalendarConfig } from "@/features/booking/components/calendar/useCalendarConfig";
import { ServicesManager } from "@/features/booking/components/calendar/ServicesManager";
import { StaffManager } from "@/features/booking/components/calendar/StaffManager";
import { AvailabilityManager } from "@/features/booking/components/calendar/AvailabilityManager";
import { LocationManager } from "@/features/booking/components/calendar/LocationManager";
import { MonthCalendar } from "@/features/booking/components/calendar/MonthCalendar";
import type { TourScreenProps } from "../types";
import { CURRENT_LOCATION_ID, LOCATION_NAME, SAMPLE_TIMES, bookableDates, buildConfig, servicesOf } from "./data";

const TAB_BY_STEP = [null, "services", "staff", "availability"] as const;

// Same trick as the real workspace: inactive tabs collapse to icons on narrow screens.
function TabLabel({ children }: { children: ReactNode }) {
  return <span className="sr-only sm:not-sr-only in-data-active:not-sr-only">{children}</span>;
}

export function BookingScreen({ step }: TourScreenProps) {
  const { t } = useLanguage();
  // The real config controller: pure local state until "save" is pressed, which
  // never happens in the inert frame.
  const sample = t.guidePage.tour.sample;
  const config = useMemo(() => buildConfig(sample), [sample]);
  const controller = useCalendarConfig("tour", config, true);
  const client = step >= 4;
  const tab = TAB_BY_STEP[step] ?? null;

  return (
    <div className="h-full overflow-hidden p-4 sm:p-6">
      {client ? (
        <ClientView step={step} />
      ) : (
        <div className="space-y-5">
          {/* Mirrors the header of /dashboard/booking */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
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

          {tab === null ? (
            <LocationManager controller={controller} />
          ) : (
            <Tabs value={tab} className="gap-5">
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
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
                  <MapPin className="h-3.5 w-3.5" />
                  {t.booking.currentLocationPillLabel.replace("{name}", LOCATION_NAME)}
                  <ChevronDown className="h-3.5 w-3.5" />
                </span>
              </div>

              {tab === "services" && <ServicesManager controller={controller} currentLocationId={CURRENT_LOCATION_ID} />}
              {tab === "staff" && <StaffManager controller={controller} currentLocationId={CURRENT_LOCATION_ID} />}
              {/* Opening hours: skip the timezone/buffer card so the weekly list fits the window */}
              {tab === "availability" && (
                <div className="[&>div>section:first-child]:hidden [&>div>section:last-of-type]:hidden">
                  <AvailabilityManager controller={controller} currentLocationId={CURRENT_LOCATION_ID} />
                </div>
              )}
            </Tabs>
          )}
        </div>
      )}
    </div>
  );
}

// What a client sees on the public page: the real month calendar, and the
// service picker built from CalendarBookingFlow's own markup (the flow itself
// loads a session and slots from the network on mount, so it can't run here).
function ClientView({ step }: { step: number }) {
  const { t, locale } = useLanguage();
  const { todayKey, dates, selected, maxKey } = useMemo(() => {
    const today = todayInZone("Europe/Rome");
    const set = bookableDates(today);
    const sorted = [...set].sort();
    return { todayKey: today, dates: set, selected: sorted[1] ?? sorted[0], maxKey: sorted[sorted.length - 1] };
  }, []);

  const services = servicesOf(t.guidePage.tour.sample).slice(0, 3);
  const picked = new Set(["svc_cut", "svc_blow"]);
  const chosen = services.filter((s) => picked.has(s.id));
  const totalMin = chosen.reduce((n, s) => n + s.duration_min, 0);
  const totalPrice = chosen.reduce((n, s) => n + (s.price_cents ?? 0), 0);
  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${selected}T12:00:00Z`),
  );

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center gap-3">
        <Avatar size="lg">
          <AvatarFallback className="bg-violet-100 font-semibold text-violet-700 dark:bg-violet-900 dark:text-violet-300">S</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-lg font-bold leading-tight tracking-tight">Studio Lume</p>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> {t.mobileTab.booking}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        {step === 4 ? (
          <div className="space-y-2">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{t.booking.chooseService}</h3>
              <p className="text-xs text-muted-foreground">{t.booking.selectServicesHint}</p>
            </div>
            {services.map((s) => {
              const checked = picked.has(s.id);
              return (
                <div
                  key={s.id}
                  className={`w-full rounded-xl border px-4 py-3 text-left ${
                    checked ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-background"
                      }`}
                    >
                      {checked && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{s.name}</span>
                        <span className="text-sm text-muted-foreground">€{((s.price_cents ?? 0) / 100).toFixed(2)}</span>
                      </div>
                      <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {t.booking.durationMin.replace("{min}", String(s.duration_min))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50/60 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/20">
                <span className="text-sm font-medium">{t.booking.total}</span>
                <span className="inline-flex items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> {t.booking.durationMin.replace("{min}", String(totalMin))}
                  </span>
                  <span className="font-semibold tabular-nums">€{(totalPrice / 100).toFixed(2)}</span>
                </span>
              </div>
              <div className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">
                {t.booking.continue}
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">
              {t.booking.pickDateTime.replace("{service}", chosen.map((s) => s.name).join(" + "))}
            </h3>
            <MonthCalendar
              availableDates={dates}
              selected={selected}
              onSelect={() => {}}
              minDate={todayKey}
              maxDate={maxKey}
            />
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{dayLabel}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {SAMPLE_TIMES.map((time, i) => (
                  <span
                    key={time}
                    className={`rounded-lg border px-2 py-2 text-center text-sm ${
                      i === 1
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                        : "border-border"
                    }`}
                  >
                    {time}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
