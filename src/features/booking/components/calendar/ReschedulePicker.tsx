"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Pencil, Sparkles } from "lucide-react";
import { todayInZone, type Slot } from "@/lib/widgets/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MonthCalendar, CalendarSkeleton } from "./MonthCalendar";
import { useLanguage } from "@/contexts/LanguageContext";

// Availability-aware "pick a new time" picker, shared by the customer manage
// page (ManageBooking) and the owner dashboard (BookingRow). Like the booking
// flow, it lets the user (optionally) re-choose the specialist PER SERVICE
// first — pre-filled with the current assignment, "Any available" always an
// option — then shows the open start times for those choices. It hands the
// chosen slot AND the per-service staff map back via `onPick`; the parent owns
// the commit (PATCH) and shows any error via `busy`/`error`.
const BOOKING_WINDOW_DAYS = 60;

type EligibleStaff = { id: string; name: string; photo_url: string | null; info: string | null };
type ContextService = {
  service_id: string;
  name: string;
  current_staff_id: string | null;
  eligible_staff: EligibleStaff[];
};

export function ReschedulePicker({
  token,
  timezone,
  busy,
  error,
  onPick,
}: {
  token: string;
  timezone: string;
  busy?: boolean;
  error?: string | null; // commit error, owned by the parent
  onPick: (slot: Slot, staffByService: Record<string, string>) => void;
}) {
  const { t, locale } = useLanguage();
  const tz = timezone;

  // Two-phase: an optional per-service staff step, then the time grid.
  const [phase, setPhase] = useState<"staff" | "time">("time");
  const [contextLoading, setContextLoading] = useState(true);
  const [staffServices, setStaffServices] = useState<ContextService[]>([]);
  const [staffByService, setStaffByService] = useState<Record<string, string>>({});

  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(true);

  // On mount, fetch the reschedule context. When a service offers a real staff
  // choice, start on the staff step (pre-filled with the current assignment);
  // otherwise skip straight to loading times.
  useEffect(() => {
    let active = true;
    fetch(`/api/widgets/bookings/${token}/reschedule-context`)
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        const services: ContextService[] = res.ok ? data.services ?? [] : [];
        const choicey = services.filter((s) => s.eligible_staff.length > 1);
        setStaffServices(choicey);
        // Seed choices with the current per-service staff.
        const seed: Record<string, string> = {};
        for (const s of services) seed[s.service_id] = s.current_staff_id ?? "";
        setStaffByService(seed);
        if (res.ok && data.needs_staff_step) {
          setPhase("staff");
        } else {
          setPhase("time");
          void loadSlots(seed);
        }
      })
      .catch(() => {
        // Context failed — fall back to a staff-agnostic time load.
        if (active) {
          setPhase("time");
          void loadSlots({});
        }
      })
      .finally(() => {
        if (active) setContextLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadSlots(staffMap: Record<string, string>) {
    setSlotsLoading(true);
    setLoadError(null);
    setSelectedDate(null);
    setCalendarOpen(true);
    try {
      const staffParam = Object.entries(staffMap)
        .map(([svc, st]) => `${svc}:${st}`)
        .join(",");
      const params = new URLSearchParams({ days: String(BOOKING_WINDOW_DAYS) });
      if (staffParam) params.set("staff", staffParam);
      const res = await fetch(`/api/widgets/bookings/${token}/slots?${params.toString()}`);
      const data = await res.json();
      setSlots(res.ok ? data.slots ?? [] : []);
      if (!res.ok) setLoadError(t.booking.errorLoadAvailability);
    } catch {
      setLoadError(t.booking.errorLoadAvailability);
    } finally {
      setSlotsLoading(false);
    }
  }

  function setServiceStaff(serviceId: string, id: string) {
    setStaffByService((prev) => ({ ...prev, [serviceId]: id }));
  }

  async function proceedFromStaff() {
    setPhase("time");
    await loadSlots(staffByService);
  }

  const fmtDay = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(
      new Date(iso)
    );

  const dateKeyFmt = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    [tz]
  );

  const slotsByDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = dateKeyFmt.format(new Date(s.start));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [slots, dateKeyFmt]);

  const availableDates = useMemo(() => new Set(slotsByDate.keys()), [slotsByDate]);

  const minDate = useMemo(() => todayInZone(tz), [tz]);
  const maxDate = useMemo(() => {
    const [y, m, d] = minDate.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + BOOKING_WINDOW_DAYS - 1, 12)).toISOString().slice(0, 10);
  }, [minDate]);

  const firstAvailable = useMemo(() => [...availableDates].sort()[0] ?? null, [availableDates]);
  const activeDate = selectedDate ?? firstAvailable;

  const daySlots = activeDate ? slotsByDate.get(activeDate) ?? [] : [];
  const activeDateLabel = activeDate ? fmtDay(`${activeDate}T12:00:00Z`) : "";

  function pickDate(key: string) {
    setSelectedDate(key);
    setCalendarOpen(false);
  }

  if (contextLoading) return <CalendarSkeleton />;

  // ── Staff step ─────────────────────────────────────────────────────────────
  if (phase === "staff") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.booking.specialistPerServiceHint}</p>
        {staffServices.map((svc) => {
          const current = staffByService[svc.service_id] ?? "";
          return (
            <div key={svc.service_id} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
              <p className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {svc.name}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={current === ""}
                  onClick={() => setServiceStaff(svc.service_id, "")}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${
                    current === ""
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                      : "border-border bg-background hover:border-emerald-400"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                    <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </span>
                  <span className="min-w-0 text-sm font-medium">{t.booking.anyAvailable}</span>
                </button>
                {svc.eligible_staff.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={current === m.id}
                    onClick={() => setServiceStaff(svc.service_id, m.id)}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${
                      current === m.id
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-border bg-background hover:border-emerald-400"
                    }`}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={m.photo_url || undefined} alt={m.name} />
                      <AvatarFallback>{m.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{m.name}</span>
                      {m.info && (
                        <span className="block truncate text-xs text-muted-foreground">{m.info}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <button
          type="button"
          onClick={proceedFromStaff}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          {t.booking.continue}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ── Time step ──────────────────────────────────────────────────────────────
  if (slotsLoading) return <CalendarSkeleton />;

  if (loadError) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
        {loadError}
      </p>
    );
  }

  if (availableDates.size === 0) {
    return (
      <div className="space-y-3">
        {staffServices.length > 0 && (
          <button
            onClick={() => setPhase("staff")}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" /> {t.booking.chooseSpecialist}
          </button>
        )}
        <p className="text-sm text-muted-foreground">
          {t.booking.noOpenSlots.replace("{days}", String(BOOKING_WINDOW_DAYS))}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {staffServices.length > 0 && (
        <button
          onClick={() => setPhase("staff")}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" /> {t.booking.chooseSpecialist}
        </button>
      )}

      {calendarOpen ? (
        <MonthCalendar
          availableDates={availableDates}
          selected={activeDate}
          onSelect={pickDate}
          minDate={minDate}
          maxDate={maxDate}
          countFor={(key) => slotsByDate.get(key)?.length ?? 0}
        />
      ) : (
        <button
          onClick={() => setCalendarOpen(true)}
          aria-label={t.booking.selectedDateChange.replace("{date}", activeDateLabel)}
          className="cursor-pointer flex w-full items-center justify-between rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3 text-left transition hover:border-emerald-400"
        >
          <span className="flex items-center gap-2.5">
            <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium">{activeDateLabel}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
            <Pencil className="h-3.5 w-3.5" /> {t.booking.change}
          </span>
        </button>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      <div>
        {activeDate ? (
          <>
            {calendarOpen && (
              <p className="mb-2 text-xs font-medium text-muted-foreground">{activeDateLabel}</p>
            )}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {daySlots.map((s) => (
                <button
                  key={s.start}
                  disabled={busy}
                  onClick={() => onPick(s, staffByService)}
                  className="rounded-lg border border-border px-2 py-2 text-sm transition hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-emerald-950/30"
                >
                  {fmtTime(s.start)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t.booking.selectDateToSeeTimes}</p>
        )}
      </div>
    </div>
  );
}
