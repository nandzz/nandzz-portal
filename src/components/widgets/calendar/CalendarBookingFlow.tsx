"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Loader2, Check, ChevronLeft, Pencil, Sparkles } from "lucide-react";
import type { CalendarConfig, CalendarService, StaffMember } from "@/lib/types";
import { eligibleStaffForService, todayInZone, type Slot } from "@/lib/widgets/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MonthCalendar, CalendarSkeleton } from "./MonthCalendar";

// How far out the calendar lets visitors book. Wider than the old flat list so
// the month grid feels real; the availability API caps `days` at 60.
const BOOKING_WINDOW_DAYS = 60;

interface Props {
  instanceId: string;
  services: CalendarService[];
  timezone: string;
  businessName: string;
  // The instance's bookable staff. Empty ⇒ single-resource business and the
  // "choose your specialist" step never appears.
  staff?: StaffMember[];
  // Whether to show service prices to the visitor. Owner-controlled; defaults to
  // shown so callers that don't pass it keep the prior behavior.
  showPrices?: boolean;
  initialServiceId?: string;
  onBooked?: (manageUrl: string) => void;
}

type Step = "service" | "slot" | "staff" | "details" | "done";

export function CalendarBookingFlow({
  instanceId,
  services,
  timezone,
  businessName,
  staff = [],
  showPrices = true,
  initialServiceId,
  onBooked,
}: Props) {
  const preselected = initialServiceId
    ? services.find((s) => s.id === initialServiceId) ?? null
    : null;
  const [step, setStep] = useState<Step>(preselected ? "slot" : "service");
  const [service, setService] = useState<CalendarService | null>(preselected);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Whether the full month grid is showing. Collapses to a compact summary once
  // the visitor actively picks a day (auto-selecting the first day keeps it open).
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [slot, setSlot] = useState<Slot | null>(null);
  // Eligible staff free at the picked slot (drives the "specialist" step). Empty
  // ⇒ no staff choice for this slot, so we skip straight to details.
  const [slotStaff, setSlotStaff] = useState<StaffMember[]>([]);
  // Chosen specialist; "" means "any available" (server auto-assigns).
  const [staffId, setStaffId] = useState<string>("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manageUrl, setManageUrl] = useState<string | null>(null);

  const tz = timezone;

  // If a service was preselected (e.g. from the AI chat), load its slots on mount.
  useEffect(() => {
    if (preselected) void loadSlots(preselected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fmtDay(iso: string) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  }
  function fmtTime(iso: string) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  }
  // Civil date ("YYYY-MM-DD") of an ISO instant in the widget timezone — the key
  // the calendar groups slots by. en-CA yields ISO-ordered output.
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
  function dateKeyOf(iso: string) {
    return dateKeyFmt.format(new Date(iso));
  }

  async function loadSlots(s: CalendarService) {
    setLoadingSlots(true);
    setError(null);
    setSelectedDate(null);
    setCalendarOpen(true);
    try {
      const res = await fetch(
        `/api/widgets/${instanceId}/availability?service_id=${encodeURIComponent(s.id)}&days=${BOOKING_WINDOW_DAYS}`
      );
      const data = await res.json();
      setSlots(res.ok ? data.slots ?? [] : []);
      if (!res.ok) setError(data.error ?? "Could not load availability.");
    } catch {
      setError("Could not load availability.");
    } finally {
      setLoadingSlots(false);
    }
  }

  async function pickService(s: CalendarService) {
    setService(s);
    setSlot(null);
    setSlotStaff([]);
    setStaffId("");
    setStep("slot");
    await loadSlots(s);
  }

  // Staff who can perform `service` AND are free at `s`. Intersects the slot's
  // free-staff list (from the availability API) with the service's eligible
  // staff. Returns [] when there's no staff data — the specialist step is then
  // skipped (single-resource instance, or the availability route hasn't attached
  // `staff_ids` yet).
  function freeStaffForSlot(s: Slot): StaffMember[] {
    if (!service || staff.length === 0) return [];
    const freeIds = s.staff_ids;
    if (!freeIds || freeIds.length === 0) return [];
    const freeSet = new Set(freeIds);
    const eligible = eligibleStaffForService({ staff } as CalendarConfig, service);
    return eligible.filter((m) => freeSet.has(m.id));
  }

  // Time-slot picked → branch into the specialist step when a choice exists.
  function pickSlot(s: Slot) {
    setSlot(s);
    setStaffId("");
    const free = freeStaffForSlot(s);
    setSlotStaff(free);
    setStep(free.length > 0 ? "staff" : "details");
  }

  async function submit() {
    if (!service || !slot) return;
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError("Name, email and phone are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/widgets/${instanceId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: service.id,
          starts_at: slot.start,
          staff_id: staffId,
          customer_name: form.name,
          customer_email: form.email,
          customer_phone: form.phone.trim(),
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not complete the booking.");
        return;
      }
      setManageUrl(data.manage_url);
      setStep("done");
      onBooked?.(data.manage_url);
    } catch {
      setError("Could not complete the booking.");
    } finally {
      setSubmitting(false);
    }
  }

  // Group slots by civil date (in the widget tz) for the calendar + time picker.
  const slotsByDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = dateKeyOf(s.start);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    // Slots arrive chronologically from the API, so each day's list already is.
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, tz]);

  const availableDates = useMemo(() => new Set(slotsByDate.keys()), [slotsByDate]);

  // Calendar bounds: today (owner tz) through the end of the booking window.
  const minDate = useMemo(() => todayInZone(tz), [tz]);
  const maxDate = useMemo(() => {
    const [y, m, d] = minDate.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + BOOKING_WINDOW_DAYS - 1, 12))
      .toISOString()
      .slice(0, 10);
  }, [minDate]);

  // Land on the first bookable date so the time picker isn't empty on arrival —
  // derived, not stored, until the visitor picks one (`selectedDate`) themselves.
  const firstAvailable = useMemo(
    () => [...availableDates].sort()[0] ?? null,
    [availableDates]
  );
  const activeDate = selectedDate ?? firstAvailable;

  const daySlots = activeDate ? slotsByDate.get(activeDate) ?? [] : [];
  const activeDateLabel = activeDate ? fmtDay(`${activeDate}T12:00:00Z`) : "";

  // Visitor actively chose a day → collapse the grid into the summary bar.
  function pickDate(key: string) {
    setSelectedDate(key);
    setCalendarOpen(false);
  }

  // Name of the chosen specialist (empty for "any available"), used in summaries.
  const chosenStaffName = staffId ? staff.find((m) => m.id === staffId)?.name ?? null : null;

  const back = () => {
    setError(null);
    // From details, return to the specialist step only when it was shown.
    if (step === "details") setStep(slotStaff.length > 0 ? "staff" : "slot");
    else if (step === "staff") setStep("slot");
    else if (step === "slot") setStep("service");
  };

  return (
    <div className="space-y-4">
      {step !== "service" && step !== "done" && (
        <button
          onClick={back}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </button>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {/* Step 1 — service */}
      {step === "service" && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Choose a service</h3>
          {services.length === 0 && (
            <p className="text-sm text-muted-foreground">No services available yet.</p>
          )}
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => pickService(s)}
              className="w-full text-left rounded-xl border border-border bg-background px-4 py-3 transition hover:border-emerald-400 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{s.name}</span>
                {showPrices && typeof s.price_cents === "number" && s.price_cents > 0 && (
                  <span className="text-sm text-muted-foreground">
                    ${(s.price_cents / 100).toFixed(2)}
                  </span>
                )}
              </div>
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> {s.duration_min} min
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Step 2 — date + time */}
      {step === "slot" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Pick a date &amp; time · {service?.name}</h3>
          {loadingSlots ? (
            <CalendarSkeleton />
          ) : availableDates.size === 0 ? (
            <p className="text-sm text-muted-foreground">
              No open slots in the next {BOOKING_WINDOW_DAYS} days.
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
                  aria-label={`Selected date: ${activeDateLabel}. Change date`}
                  className="cursor-pointer flex w-full items-center justify-between rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3 text-left transition hover:border-emerald-400"
                >
                  <span className="flex items-center gap-2.5">
                    <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium">{activeDateLabel}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                    <Pencil className="h-3.5 w-3.5" /> Change
                  </span>
                </button>
              )}

              <div>
                {activeDate ? (
                  <>
                    {calendarOpen && (
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        {activeDateLabel}
                      </p>
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
                  <p className="text-sm text-muted-foreground">Select a date to see open times.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3 — specialist (only when the picked slot has eligible free staff) */}
      {step === "staff" && slot && (
        <div className="space-y-2">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Choose your specialist</h3>
            <p className="text-sm text-muted-foreground">
              {service?.name} · {fmtDay(slot.start)} at {fmtTime(slot.start)}
            </p>
          </div>

          {/* Any available — auto-assign; sets the chosen id to "". */}
          <button
            onClick={() => {
              setStaffId("");
              setStep("details");
            }}
            className="w-full text-left rounded-xl border border-border bg-background px-4 py-3 transition hover:border-emerald-400 hover:shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-medium">Any available</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  No preference — we&apos;ll assign a free specialist
                </span>
              </div>
            </div>
          </button>

          {slotStaff.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setStaffId(m.id);
                setStep("details");
              }}
              className="w-full text-left rounded-xl border border-border bg-background px-4 py-3 transition hover:border-emerald-400 hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Avatar size="lg" className="shrink-0">
                  <AvatarImage src={m.photo_url || undefined} alt={m.name} />
                  <AvatarFallback>{m.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium">{m.name}</span>
                  {m.info && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {m.info}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 4 — details */}
      {step === "details" && slot && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Your details</h3>
          <p className="text-sm text-muted-foreground">
            {service?.name} · {fmtDay(slot.start)} at {fmtTime(slot.start)}
            {chosenStaffName && <> · with {chosenStaffName}</>}
          </p>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Phone"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <textarea
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Notes (optional)"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirm booking
          </button>
        </div>
      )}

      {/* Step 5 — done */}
      {step === "done" && (
        <div className="space-y-3 text-center py-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-base font-semibold">You&apos;re booked!</h3>
          {chosenStaffName && (
            <p className="text-sm font-medium">with {chosenStaffName}</p>
          )}
          <p className="text-sm text-muted-foreground">
            A confirmation was sent to {form.email}. You can reschedule or cancel anytime.
          </p>
          {manageUrl && (
            <a
              href={manageUrl}
              className="inline-block text-sm font-medium text-emerald-600 hover:underline"
            >
              Manage your booking
            </a>
          )}
        </div>
      )}

      <p className="pt-2 text-center text-[10px] text-muted-foreground">
        Powered by {businessName}&apos;s calendar · times in {tz}
      </p>
    </div>
  );
}
