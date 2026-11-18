"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  FileText,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CalendarService, StaffMember } from "@/lib/types";
import {
  eligibleStaffForServices,
  todayInZone,
  type Slot,
} from "@/features/booking/domain/calendar";
import { BOOKING_ERROR_KEYS } from "@/features/booking/domain/booking-errors";
import { Dialog } from "@/components/ui/dialog";
import { MonthCalendar, CalendarSkeleton } from "../MonthCalendar";

// Opened from the Today tab when a client calls: pick a service (+ optionally
// a staff member) and see the free times up to six months ahead — the next
// two weeks at a glance, or month by month — then book a picked time through
// the same /book route as a manual booking.

// How far ahead the owner can look (the public funnel stays at 60 days). The
// availability endpoint caps one request at 60 days, so the window is loaded
// as parallel chunks via its `from` param.
const WINDOW_MONTHS = 6;
const CHUNK_DAYS = 60;
const STRIP_DAYS = 14;

export type AvailabilityScope = {
  instanceId: string;
  locationId: string | null;
  services: CalendarService[];
  staff: StaffMember[];
  timezone: string;
};

export function CheckAvailabilityModal({
  open,
  onClose,
  scope,
}: {
  open: boolean;
  onClose: () => void;
  scope: AvailabilityScope;
}) {
  const { t } = useLanguage();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.bookingToday.availTitle}
      maxWidthClass="max-w-5xl"
    >
      {/* Mounted only while open, so every call starts from a clean slate. */}
      <AvailabilityBody scope={scope} />
    </Dialog>
  );
}

function AvailabilityBody({ scope }: { scope: AvailabilityScope }) {
  const { t, locale } = useLanguage();
  const tt = t.bookingToday;
  const { instanceId, locationId, services, staff, timezone } = scope;

  const [serviceId, setServiceId] = useState<string>(services[0]?.id ?? "");
  const [staffId, setStaffId] = useState("");
  const [view, setView] = useState<"days" | "month">("days");
  // Last fetched result, tagged with its query; loading = the tag is stale.
  const [result, setResult] = useState<{
    query: string;
    slots: Slot[];
    error: false | "disabled" | "plan" | "failed";
  } | null>(null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [pickedSlot, setPickedSlot] = useState<Slot | null>(null);
  // Bumped after a booking so the booked time drops out of the free slots.
  const [reload, setReload] = useState(0);
  const service = services.find((s) => s.id === serviceId) ?? null;
  const eligibleStaff = useMemo(
    () => (service ? eligibleStaffForServices(staff, [service]) : []),
    [staff, service],
  );

  const today = useMemo(() => todayInZone(timezone), [timezone]);
  const maxDate = useMemo(
    () => addDays(addMonths(today, WINDOW_MONTHS), -1),
    [today],
  );
  const windowDays = useMemo(
    () => daysBetween(today, maxDate) + 1,
    [today, maxDate],
  );

  const query = useMemo(() => {
    // owner=1 ⇒ the route answers 402 when the plan lacks booking (instead of
    // empty slots) and skips the minimum notice, like the manual-booking modal.
    const params = new URLSearchParams({ service_ids: serviceId, owner: "1" });
    if (staffId) params.set("staff_id", staffId);
    if (locationId) params.set("location_id", locationId);
    return params.toString();
  }, [serviceId, staffId, locationId]);
  // Tags a fetch result; also changes after a booking to force a refetch.
  const fetchKey = `${query}#${reload}`;

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    const chunks: Promise<Slot[]>[] = [];
    for (let off = 0; off < windowDays; off += CHUNK_DAYS) {
      const days = Math.min(CHUNK_DAYS, windowDays - off);
      chunks.push(
        fetch(
          `/api/widgets/${instanceId}/availability?${query}&from=${addDays(today, off)}&days=${days}`,
        ).then(async (res) => {
          if (!res.ok) throw new Error(String(res.status));
          return ((await res.json()).slots ?? []) as Slot[];
        }),
      );
    }
    Promise.all(chunks)
      .then((parts) => {
        if (!cancelled) setResult({ query: fetchKey, slots: parts.flat(), error: false });
      })
      .catch((e: unknown) => {
        // The route 404s when the widget is turned off and 402s when the plan
        // lacks booking — say so instead of a generic failure.
        const status = e instanceof Error ? e.message : "";
        const error =
          status === "402" ? "plan" : status === "404" ? "disabled" : "failed";
        if (!cancelled) setResult({ query: fetchKey, slots: [], error });
      });
    return () => {
      cancelled = true;
    };
  }, [instanceId, serviceId, query, fetchKey, today, windowDays]);

  const loading = !!serviceId && result?.query !== fetchKey;
  const slots = useMemo(
    () => (loading ? [] : (result?.slots ?? [])),
    [loading, result],
  );
  const error = loading ? false : (result?.error ?? false);

  const fmt = useMemo(
    () => ({
      key: new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
      weekday: new Intl.DateTimeFormat(locale, {
        timeZone: "UTC",
        weekday: "short",
      }),
      dayNum: new Intl.DateTimeFormat(locale, {
        timeZone: "UTC",
        day: "numeric",
      }),
      month: new Intl.DateTimeFormat(locale, {
        timeZone: "UTC",
        month: "short",
      }),
      day: new Intl.DateTimeFormat(locale, {
        timeZone: "UTC",
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      time: new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
      }),
      hm: new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    }),
    [locale, timezone],
  );

  const slotsByDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = fmt.key.format(new Date(s.start));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [slots, fmt]);

  const stripDays = useMemo(
    () => Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i)),
    [today],
  );
  const availableDates = useMemo(
    () => new Set(slotsByDate.keys()),
    [slotsByDate],
  );
  const firstFree = useMemo(
    () => [...availableDates].sort()[0] ?? null,
    [availableDates],
  );
  const activeDate = pickedDate ?? firstFree ?? today;
  const daySlots = useMemo(
    () => slotsByDate.get(activeDate) ?? [],
    [slotsByDate, activeDate],
  );
  const label = (key: string) => fmt.day.format(new Date(`${key}T12:00:00Z`));

  // The details column shows once a time is picked.
  const showSide = !!pickedSlot;

  // The active day's free times, grouped by part of day.
  function renderTimes() {
    if (loading) {
      return (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      );
    }
    const groups: { label: string; slots: Slot[] }[] = [
      { label: tt.availMorning, slots: [] },
      { label: tt.availAfternoon, slots: [] },
      { label: tt.availEvening, slots: [] },
    ];
    for (const s of daySlots) {
      const h = Number(fmt.hm.format(new Date(s.start)).slice(0, 2));
      groups[h < 12 ? 0 : h < 17 ? 1 : 2].slots.push(s);
    }
    return (
      <div className="space-y-4">
        <p className="text-sm font-semibold first-letter:uppercase">
          {label(activeDate)}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {tt.availSlotsCount.replace("{count}", String(daySlots.length))}
          </span>
        </p>
        {availableDates.size === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tt.availNoSlotsWindow.replace("{months}", String(WINDOW_MONTHS))}
          </p>
        ) : daySlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tt.availNoSlotsDay}</p>
        ) : (
          groups
            .filter((g) => g.slots.length > 0)
            .map((g) => (
              <div key={g.label}>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </p>
                <div
                  className={cn(
                    "grid grid-cols-3 gap-2",
                    view === "days" && "sm:grid-cols-6",
                    view === "days" && !showSide && "lg:grid-cols-8",
                  )}
                >
                  {g.slots.map((s) => {
                    const active = pickedSlot?.start === s.start;
                    return (
                      <button
                        key={s.start}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPickedSlot(active ? null : s)}
                        className={cn(
                          "h-9 rounded-lg border text-sm tabular-nums transition outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                          active
                            ? "border-emerald-500 bg-emerald-600 font-semibold text-white"
                            : "border-border hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
                        )}
                      >
                        {fmt.time.format(new Date(s.start))}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
        )}
      </div>
    );
  }

  return (
    <div className="-mx-6 -mb-6 max-h-[75vh] overflow-y-auto border-t border-border">
      <div className={cn(showSide && "lg:grid lg:grid-cols-5")}>
        {/* Availability */}
        <div className={cn("space-y-5 p-6", showSide && "lg:col-span-3")}>
          <p className="text-sm text-muted-foreground">{tt.availSubtitle}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {tt.availService}
              </span>
              <select
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setStaffId("");
                  setPickedSlot(null);
                }}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.duration_min} min
                  </option>
                ))}
              </select>
            </label>
            {eligibleStaff.length > 0 && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {tt.availStaff}
                </span>
                <select
                  value={staffId}
                  onChange={(e) => {
                    setStaffId(e.target.value);
                    setPickedSlot(null);
                  }}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{tt.availAnyStaff}</option>
                  {eligibleStaff.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">
              {loading ? (
                <span className="text-muted-foreground">{tt.availLoading}</span>
              ) : firstFree ? (
                <>
                  <span className="text-muted-foreground">
                    {tt.availFirstFree}{" "}
                  </span>
                  <span className="font-semibold first-letter:uppercase">
                    {label(firstFree)},{" "}
                    {fmt.time.format(
                      new Date(slotsByDate.get(firstFree)![0].start),
                    )}
                  </span>
                </>
              ) : null}
            </p>
            <div
              role="tablist"
              className="inline-flex shrink-0 rounded-lg border border-border p-0.5 text-xs font-medium"
            >
              {(["days", "month"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-md px-2.5 py-1 transition-colors",
                    view === v
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v === "days" ? tt.availViewDays : tt.availViewMonth}
                </button>
              ))}
            </div>
          </div>

          {!service ? (
            <p className="text-sm text-muted-foreground">
              {tt.availNoServices}
            </p>
          ) : error ? (
            error === "plan" ? (
              <p className="text-sm text-muted-foreground">
                {t.booking.errorPlanRequired}{" "}
                <Link
                  href="/dashboard/subscription"
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  {t.booking.planRequiredCta}
                </Link>
              </p>
            ) : error === "disabled" ? (
              <p className="text-sm text-muted-foreground">
                {tt.availDisabled}
              </p>
            ) : (
              <p className="text-sm text-rose-600 dark:text-rose-400">
                {tt.availError}
              </p>
            )
          ) : view === "month" ? (
            // Month: a compact calendar with the chosen day's times beside it.
            <div className="grid gap-4 sm:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
              {loading ? (
                <CalendarSkeleton />
              ) : (
                <MonthCalendar
                  availableDates={availableDates}
                  selected={activeDate}
                  onSelect={(key) => {
                    setPickedDate(key);
                    setPickedSlot(null);
                  }}
                  minDate={today}
                  maxDate={maxDate}
                  countFor={(key) => slotsByDate.get(key)?.length ?? 0}
                />
              )}
              <div className="rounded-2xl border border-border bg-background p-4 sm:max-h-[372px] sm:overflow-y-auto">
                {renderTimes()}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1.5">
                {loading
                  ? Array.from({ length: STRIP_DAYS }, (_, i) => (
                      <div
                        key={i}
                        className="h-[68px] animate-pulse rounded-xl bg-muted"
                      />
                    ))
                  : stripDays.map((key) => {
                      const d = new Date(`${key}T12:00:00Z`);
                      const count = slotsByDate.get(key)?.length ?? 0;
                      const active = key === activeDate;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={count === 0}
                          aria-pressed={active}
                          onClick={() => {
                            setPickedDate(key);
                            setPickedSlot(null);
                          }}
                          className={cn(
                            "flex flex-col items-center rounded-xl border px-1 py-2 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                            active
                              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                              : count > 0
                                ? "border-border hover:border-emerald-400"
                                : "border-dashed border-border opacity-50",
                          )}
                        >
                          <span className="text-[11px] uppercase text-muted-foreground">
                            {key === today ? tt.tab : fmt.weekday.format(d)}
                          </span>
                          <span className="text-base font-semibold tabular-nums leading-tight">
                            {fmt.dayNum.format(d)}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 text-[11px] tabular-nums",
                              count > 0
                                ? "font-medium text-emerald-700 dark:text-emerald-300"
                                : "text-muted-foreground",
                            )}
                          >
                            {count > 0 ? count : "—"}
                          </span>
                        </button>
                      );
                    })}
              </div>
              {!loading && renderTimes()}
            </>
          )}
        </div>

        {/* Booking details */}
        {pickedSlot && (
          <DetailsPanel
            // Fresh form (and no stale "Booked" view) for every picked time.
            key={`${pickedSlot.start}|${serviceId}|${staffId}`}
            instanceId={instanceId}
            locationId={locationId}
            serviceId={service?.id ?? null}
            serviceName={service?.name ?? null}
            staffId={staffId}
            staffName={staff.find((m) => m.id === staffId)?.name ?? null}
            slot={pickedSlot}
            slotLabel={`${label(fmt.key.format(new Date(pickedSlot.start)))}, ${fmt.time.format(new Date(pickedSlot.start))}`}
            onBooked={() => setReload((n) => n + 1)}
            onNewCall={() => setPickedSlot(null)}
          />
        )}
      </div>
    </div>
  );
}

// Right-hand column: the booking details for the picked time.
function DetailsPanel({
  instanceId,
  locationId,
  serviceId,
  serviceName,
  staffName,
  staffId,
  slot,
  slotLabel,
  onBooked,
  onNewCall,
}: {
  instanceId: string;
  locationId: string | null;
  serviceId: string | null;
  serviceName: string | null;
  staffName: string | null;
  staffId: string;
  slot: Slot;
  slotLabel: string;
  onBooked: () => void;
  onNewCall: () => void;
}) {
  const { t } = useLanguage();
  const tt = t.bookingToday;
  const [booked, setBooked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function book() {
    if (!serviceId) return;
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
          service_ids: [serviceId],
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
        const key = BOOKING_ERROR_KEYS[data.error as string] as
          keyof typeof t.booking | undefined;
        setError(key ? t.booking[key] : t.booking.errorGeneric);
        return;
      }
      setBooked(true);
      onBooked();
    } catch {
      setError(t.booking.errorBookingFailed);
    } finally {
      setSubmitting(false);
    }
  }

  function newCall() {
    setBooked(false);
    setError(null);
    setForm({ name: "", phone: "", email: "", notes: "" });
    onNewCall();
  }

  const field =
    "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (booked) {
    return (
      <aside className="flex flex-col gap-4 border-t border-border bg-muted/30 p-6 lg:col-span-2 lg:border-l lg:border-t-0">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-background px-4 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Check className="h-5 w-5" />
          </span>
          <p className="font-semibold">{tt.callBooked}</p>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {form.name} · {slotLabel}
          </p>
          <button
            type="button"
            onClick={newCall}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            <RotateCcw className="h-3.5 w-3.5" /> {tt.callNewCall}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col gap-5 border-t border-border bg-muted/30 p-6 lg:col-span-2 lg:border-l lg:border-t-0">
      <section className="space-y-4">
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-semibold">{tt.detailsTitle}</h3>
            <p className="text-xs text-muted-foreground">{tt.detailsHint}</p>
          </div>
        </div>

        <dl className="divide-y divide-border rounded-xl border border-border bg-background text-sm">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="text-muted-foreground">{tt.availService}</dt>
            <dd className="text-right font-medium">{serviceName ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="text-muted-foreground">{tt.availStaff}</dt>
            <dd className="text-right font-medium">
              {staffName ?? tt.availAnyStaff}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="text-muted-foreground">{tt.callDraftWhen}</dt>
            <dd
              className={cn(
                "flex items-center gap-1.5 text-right first-letter:uppercase",
                "font-medium",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              {slotLabel}
            </dd>
          </div>
        </dl>

        <div className="grid gap-2">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={tt.callDraftCustomer}
            aria-label={tt.callDraftCustomer}
            className={field}
          />
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder={tt.callDraftPhone}
            aria-label={tt.callDraftPhone}
            inputMode="tel"
            className={field}
          />
          <input
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder={tt.callDraftEmail}
            aria-label={tt.callDraftEmail}
            inputMode="email"
            className={field}
          />
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder={tt.callDraftNotes}
            aria-label={tt.callDraftNotes}
            rows={2}
            className={cn(field, "h-auto py-2")}
          />
        </div>

        {error && (
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        )}

        <button
          type="button"
          onClick={book}
          disabled={submitting || !serviceId}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}{" "}
          {tt.callConfirm}
        </button>
      </section>
    </aside>
  );
}

function addMonths(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, d, 12)).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );
}

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}
