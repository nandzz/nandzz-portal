"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Pencil,
  Search,
  Sparkles,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import type { CalendarCategory, CalendarService, StaffMember } from "@/lib/types";
import { eligibleStaffForServices, todayInZone, type Slot } from "@/features/booking/domain/calendar";
import { BOOKING_ERROR_KEYS } from "@/features/booking/domain/booking-errors";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { MonthCalendar, CalendarSkeleton } from "./MonthCalendar";
import type { CustomerSummary } from "./WidgetCustomers";
import { useLanguage } from "@/contexts/LanguageContext";

// Owner-side "book on behalf of a client" flow, rendered in a modal from the
// Bookings tab. It mirrors the public CalendarBookingFlow (service → specialist
// → day/time), but is scoped to the already-chosen location, drops the
// location/address steps, and — because a phone-in client may have no email —
// requires only a name + phone. It hits the same public availability + /book
// endpoints; the owner is recorded as `created_by` (the route reads the session).
//
// Owner-only: the details step can prefill from an existing client. The list
// comes from the owner-scoped dashboard endpoint (ownership enforced there and
// in widget_customers_summary), so it is never reachable from the public funnel.

const CLIENT_MATCH_LIMIT = 5;

const BOOKING_WINDOW_DAYS = 60;

type Step = "service" | "staff" | "slot" | "details" | "done";

interface Props {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  // The location this booking belongs to (null in legacy single-location mode).
  locationId: string | null;
  services: CalendarService[];
  categories: CalendarCategory[];
  staff: StaffMember[];
  timezone: string;
  showPrices: boolean;
  currencySymbol: string;
  // Day pre-selected when opened from a calendar cell ("YYYY-MM-DD"); the flow
  // still starts at the service step, then lands on this day once slots load.
  initialDate?: string | null;
  // Called after a successful create so the parent can refresh the dashboard.
  onBooked: () => void;
}

export function ManualBookingModal({
  open,
  onClose,
  instanceId,
  locationId,
  services,
  categories,
  staff,
  timezone,
  showPrices,
  currencySymbol,
  initialDate,
  onBooked,
}: Props) {
  const { t, locale } = useLanguage();

  const [step, setStep] = useState<Step>("service");
  const [selectedServices, setSelectedServices] = useState<CalendarService[]>([]);
  const [staffId, setStaffId] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  // Existing-client picker (details step). `null` ⇒ not loaded yet.
  const [customers, setCustomers] = useState<CustomerSummary[] | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [pickedClient, setPickedClient] = useState<CustomerSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The modal is mounted only while open (see the caller), so this component's
  // state starts fresh on every open — no reset-on-open effect needed. A second
  // manual booking never inherits the previous one's selections.

  const money = (cents: number) =>
    `${currencySymbol}${(cents / 100).toLocaleString(undefined, {
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;

  const totalDuration = selectedServices.reduce((n, s) => n + (s.duration_min || 0), 0);
  const totalPriceCents = selectedServices.reduce((n, s) => n + (s.price_cents ?? 0), 0);
  const anyPriced = selectedServices.some(
    (s) => typeof s.price_cents === "number" && s.price_cents > 0
  );
  const servicesLabel = selectedServices.map((s) => s.name).join(" + ");

  const eligibleStaff = eligibleStaffForServices(staff, selectedServices);

  function fmtDay(iso: string) {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  }
  function fmtTime(iso: string) {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  }
  const dateKeyFmt = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    [timezone]
  );

  async function loadSlots(svcs: CalendarService[], forStaffId = "") {
    if (svcs.length === 0) return;
    setLoadingSlots(true);
    setError(null);
    setSelectedDate(null);
    setCalendarOpen(true);
    try {
      const params = new URLSearchParams({
        service_ids: svcs.map((s) => s.id).join(","),
        days: String(BOOKING_WINDOW_DAYS),
      });
      if (forStaffId) params.set("staff_id", forStaffId);
      if (locationId) params.set("location_id", locationId);
      const res = await fetch(`/api/widgets/${instanceId}/availability?${params.toString()}`);
      const data = await res.json();
      setSlots(res.ok ? data.slots ?? [] : []);
      if (!res.ok) setError(t.booking.errorLoadAvailability);
    } catch {
      setError(t.booking.errorLoadAvailability);
    } finally {
      setLoadingSlots(false);
    }
  }

  function toggleService(s: CalendarService) {
    setSelectedServices((prev) =>
      prev.some((x) => x.id === s.id) ? prev.filter((x) => x.id !== s.id) : [...prev, s]
    );
  }

  async function proceedFromServices() {
    if (selectedServices.length === 0) return;
    setSlot(null);
    setStaffId("");
    // Any eligible staff ⇒ show the specialist step: a real choice for 2+, or a
    // confirmation of who'll do the work when there's exactly one.
    if (eligibleStaffForServices(staff, selectedServices).length > 0) {
      setStep("staff");
      return;
    }
    setStep("slot");
    await loadSlots(selectedServices);
  }

  async function pickStaff(id: string) {
    setStaffId(id);
    setStep("slot");
    await loadSlots(selectedServices, id);
  }

  function pickSlot(s: Slot) {
    setSlot(s);
    setStep("details");
  }

  async function submit() {
    if (selectedServices.length === 0 || !slot) return;
    if (!form.name.trim() || !form.phone.trim()) {
      setError(t.booking.errorRequiredFields);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/widgets/${instanceId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_ids: selectedServices.map((s) => s.id),
          starts_at: slot.start,
          staff_id: staffId,
          location_id: locationId ?? undefined,
          customer_name: form.name.trim(),
          customer_email: form.email.trim() || undefined,
          customer_phone: form.phone.trim(),
          notes: form.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const key = BOOKING_ERROR_KEYS[data.error as string] as keyof typeof t.booking | undefined;
        setError(key ? t.booking[key] : t.booking.errorGeneric);
        return;
      }
      setStep("done");
      onBooked();
    } catch {
      setError(t.booking.errorBookingFailed);
    } finally {
      setSubmitting(false);
    }
  }

  // Lazily load this location's clients the first time the details step opens.
  // A failure just hides the picker — the owner can still type a new client.
  useEffect(() => {
    if (step !== "details" || customers !== null) return;
    let cancelled = false;
    const qs = new URLSearchParams({ view: "customers", loc: locationId ?? "" });
    fetch(`/api/widgets/${instanceId}/dashboard?${qs.toString()}`)
      .then((res) => (res.ok ? res.json() : { customers: [] }))
      .then((data: { customers?: CustomerSummary[] }) => {
        if (!cancelled) setCustomers(data.customers ?? []);
      })
      .catch(() => {
        if (!cancelled) setCustomers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [step, customers, instanceId, locationId]);

  const clientMatches = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q || !customers) return [];
    const digits = q.replace(/\D/g, "");
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (digits.length >= 3 && (c.phone ?? "").replace(/\D/g, "").includes(digits))
      )
      .slice(0, CLIENT_MATCH_LIMIT);
  }, [customers, clientQuery]);

  function pickClient(c: CustomerSummary) {
    setPickedClient(c);
    setClientQuery("");
    setForm((f) => ({ ...f, name: c.name, email: c.email, phone: c.phone ?? "" }));
  }

  function clearClient() {
    setPickedClient(null);
    setForm((f) => ({ ...f, name: "", email: "", phone: "" }));
  }

  // Group slots by civil date (widget tz) for the calendar + time picker.
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
  const minDate = useMemo(() => todayInZone(timezone), [timezone]);
  const maxDate = useMemo(() => {
    const [y, m, d] = minDate.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + BOOKING_WINDOW_DAYS - 1, 12)).toISOString().slice(0, 10);
  }, [minDate]);

  // Prefer the day the owner clicked in the calendar (if it has open slots),
  // else the first bookable day, so the time picker is never empty on arrival.
  const firstAvailable = useMemo(() => {
    if (initialDate && availableDates.has(initialDate)) return initialDate;
    return [...availableDates].sort()[0] ?? null;
  }, [availableDates, initialDate]);
  const activeDate = selectedDate ?? firstAvailable;
  const daySlots = activeDate ? slotsByDate.get(activeDate) ?? [] : [];
  const activeDateLabel = activeDate ? fmtDay(`${activeDate}T12:00:00Z`) : "";

  function pickDate(key: string) {
    setSelectedDate(key);
    setCalendarOpen(false);
  }

  const chosenStaff = staffId ? staff.find((m) => m.id === staffId) ?? null : null;

  const back = () => {
    setError(null);
    if (step === "details") setStep("slot");
    else if (step === "slot") setStep(eligibleStaff.length > 0 ? "staff" : "service");
    else if (step === "staff") setStep("service");
  };

  function renderServiceOption(s: CalendarService) {
    const checked = selectedServices.some((x) => x.id === s.id);
    return (
      <button
        key={s.id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => toggleService(s)}
        className={`w-full text-left rounded-xl border px-4 py-3 transition hover:shadow-sm ${
          checked
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
            : "border-border bg-background hover:border-emerald-400"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
              checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-background"
            }`}
          >
            {checked && <Check className="h-3.5 w-3.5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{s.name}</span>
              {showPrices && typeof s.price_cents === "number" && s.price_cents > 0 && (
                <span className="text-sm text-muted-foreground">{money(s.price_cents)}</span>
              )}
            </div>
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {t.booking.durationMin.replace("{min}", String(s.duration_min))}
            </span>
          </div>
        </div>
      </button>
    );
  }

  function renderServiceList() {
    const catIds = new Set(categories.map((c) => c.id));
    const activeCats = categories.filter((cat) => services.some((s) => s.category_id === cat.id));
    if (activeCats.length === 0) return <>{services.map(renderServiceOption)}</>;
    const uncategorized = services.filter((s) => !s.category_id || !catIds.has(s.category_id));
    return (
      <>
        {activeCats.map((cat) => (
          <div key={cat.id} className="space-y-2">
            <p className="px-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {cat.name?.trim()}
            </p>
            {services.filter((s) => s.category_id === cat.id).map(renderServiceOption)}
          </div>
        ))}
        {uncategorized.length > 0 && (
          <div className="space-y-2">
            <p className="px-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.booking.uncategorized}
            </p>
            {uncategorized.map(renderServiceOption)}
          </div>
        )}
      </>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title={t.booking.newBooking} maxWidthClass="max-w-lg">
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-0.5">
        {step === "service" && (
          <p className="-mt-1 text-xs text-muted-foreground">{t.booking.newBookingHint}</p>
        )}

        {step !== "service" && step !== "done" && (
          <button
            onClick={back}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> {t.booking.back}
          </button>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          >
            {error}
          </p>
        )}

        {/* Step 1 — service */}
        {step === "service" && (
          <div className="space-y-2">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{t.booking.chooseService}</h3>
              <p className="text-xs text-muted-foreground">{t.booking.selectServicesHint}</p>
            </div>
            {services.length === 0 && (
              <p className="text-sm text-muted-foreground">{t.booking.noServicesAvailable}</p>
            )}
            {renderServiceList()}

            {selectedServices.length > 0 && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50/60 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/20">
                  <span className="text-sm font-medium">{t.booking.total}</span>
                  <span className="inline-flex items-center gap-3 text-sm">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {t.booking.durationMin.replace("{min}", String(totalDuration))}
                    </span>
                    {showPrices && anyPriced && (
                      <span className="font-semibold tabular-nums">{money(totalPriceCents)}</span>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={proceedFromServices}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  {t.booking.continue}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2 — specialist */}
        {step === "staff" && eligibleStaff.length === 1 && (
          <div className="space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{t.booking.summarySpecialist}</h3>
              <p className="text-sm text-muted-foreground">
                {t.booking.specialistForService.replace("{service}", servicesLabel)}
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/60 bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30">
              <Avatar size="lg" className="shrink-0">
                <AvatarImage src={eligibleStaff[0].photo_url || undefined} alt={eligibleStaff[0].name} />
                <AvatarFallback>{eligibleStaff[0].name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium">{eligibleStaff[0].name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t.booking.specialistAvailable.replace("{name}", eligibleStaff[0].name)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => pickStaff(eligibleStaff[0].id)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              {t.booking.continue}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === "staff" && eligibleStaff.length > 1 && (
          <div className="space-y-2">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{t.booking.chooseSpecialist}</h3>
              <p className="text-sm text-muted-foreground">
                {t.booking.specialistForService.replace("{service}", servicesLabel)}
              </p>
            </div>

            <button
              onClick={() => pickStaff("")}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:border-emerald-400 hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                  <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-medium">{t.booking.anyAvailable}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t.booking.anyAvailableDesc}
                  </span>
                </div>
              </div>
            </button>

            {eligibleStaff.map((m) => (
              <button
                key={m.id}
                onClick={() => pickStaff(m.id)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:border-emerald-400 hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <Avatar size="lg" className="shrink-0">
                    <AvatarImage src={m.photo_url || undefined} alt={m.name} />
                    <AvatarFallback>{m.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium">{m.name}</span>
                    {m.info && (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{m.info}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 3 — date + time */}
        {step === "slot" && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">
              {t.booking.pickDateTime.replace("{service}", servicesLabel)}
            </h3>
            {loadingSlots ? (
              <CalendarSkeleton />
            ) : availableDates.size === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t.booking.noOpenSlots.replace("{days}", String(BOOKING_WINDOW_DAYS))}
              </p>
            ) : (
              <>
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
                    className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50/60 px-4 py-3 text-left transition hover:border-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/20"
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

                <div>
                  {activeDate ? (
                    <>
                      {calendarOpen && (
                        <p className="mb-2 text-xs font-medium text-muted-foreground">{activeDateLabel}</p>
                      )}
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {daySlots.map((s) => {
                          const active = slot?.start === s.start;
                          return (
                            <button
                              key={s.start}
                              aria-pressed={active}
                              onClick={() => pickSlot(s)}
                              className={`rounded-lg border px-2 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                                active
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                  : "border-border hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              }`}
                            >
                              {fmtTime(s.start)}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t.booking.selectDateToSeeTimes}</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 4 — customer details (name + phone required; email optional) */}
        {step === "details" && slot && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-border bg-muted/40 divide-y divide-border/70">
              <div className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                  <Tag className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{servicesLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.booking.durationMin.replace("{min}", String(totalDuration))}
                    {showPrices && anyPriced ? ` · ${money(totalPriceCents)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{fmtDay(slot.start)}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtTime(slot.start)}
                    {chosenStaff ? ` · ${chosenStaff.name}` : ""}
                  </p>
                </div>
              </div>
            </div>

            <h3 className="pt-1 text-sm font-semibold">{t.booking.manualCustomerHeading}</h3>

            {pickedClient ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50/60 px-3.5 py-2.5 dark:border-emerald-800 dark:bg-emerald-950/30">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                  <UserRound className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{pickedClient.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[pickedClient.phone, pickedClient.email].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearClient}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  {t.booking.manualExistingClientChange}
                </button>
              </div>
            ) : (
              customers &&
              customers.length > 0 && (
                <div className="space-y-1.5">
                  <label htmlFor="manual-client-search" className="text-xs font-medium text-muted-foreground">
                    {t.booking.manualExistingClientLabel}
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="manual-client-search"
                      className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm"
                      placeholder={t.booking.manualExistingClientSearch}
                      autoComplete="off"
                      value={clientQuery}
                      onChange={(e) => setClientQuery(e.target.value)}
                    />
                  </div>
                  {clientQuery.trim() !== "" && (
                    <div className="overflow-hidden rounded-lg border border-border divide-y divide-border/70">
                      {clientMatches.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          {t.booking.manualExistingClientNoMatch}
                        </p>
                      ) : (
                        clientMatches.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => pickClient(c)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-muted"
                          >
                            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{c.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {[c.phone, c.email].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  <p className="pt-1 text-xs font-medium text-muted-foreground">{t.booking.manualNewClient}</p>
                </div>
              )
            )}

            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder={t.booking.fullNamePlaceholder}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder={t.booking.phonePlaceholder}
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder={t.booking.manualEmailOptionalPlaceholder}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <textarea
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder={t.booking.notesPlaceholder}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <button
              onClick={submit}
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t.booking.manualCreateBooking}
            </button>
          </div>
        )}

        {/* Step 5 — done */}
        {step === "done" && (
          <div className="space-y-3 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-base font-semibold">{t.booking.manualBookingCreatedTitle}</h3>
            <p className="text-sm text-muted-foreground">{t.booking.manualBookingCreatedDesc}</p>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted"
            >
              {t.booking.manualDone}
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
