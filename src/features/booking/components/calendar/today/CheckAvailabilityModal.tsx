"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, FileText, Loader2, Mic, PhoneCall, RotateCcw, Square, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURES } from "@/lib/flags";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CalendarService, StaffMember } from "@/lib/types";
import { eligibleStaffForServices, todayInZone, type Slot } from "@/features/booking/domain/calendar";
import { BOOKING_ERROR_KEYS } from "@/features/booking/domain/booking-errors";
import { Dialog } from "@/components/ui/dialog";
import { MonthCalendar, CalendarSkeleton } from "../MonthCalendar";

// Opened from the Today tab when a client calls: pick a service (+ optionally
// a staff member) and see the free times up to six months ahead — the next
// two weeks at a glance, or month by month — then book a picked time.
//
// The call assistant (FEATURES.callAssist, dev only, a prototype) records the
// microphone (a phone on speaker), and when the call ends posts the audio to
// the `call-booking` edge function, which transcribes it and extracts a
// booking draft. The draft drives the availability panel (service, staff,
// day, closest free time). Booking always goes through the same /book route
// as a manual booking.

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

type CallState = "idle" | "recording" | "recorded" | "processing" | "draft" | "booked";
type TimeWindow = "morning" | "afternoon" | "evening";

// What `call-booking` extracts from the call (see the edge function's schema).
type CallDraft = {
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  service_ids: string[];
  staff_id: string | null;
  date: string | null;
  time: string | null;
  time_window: TimeWindow | null;
  notes: string | null;
  summary: string;
};

const MAX_RECORDING_S = 20 * 60;

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
    <Dialog open={open} onClose={onClose} title={t.bookingToday.availTitle} maxWidthClass="max-w-5xl">
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
  const [result, setResult] = useState<{ query: string; slots: Slot[]; error: boolean } | null>(null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [pickedSlot, setPickedSlot] = useState<Slot | null>(null);
  // Time the caller asked for (from the call draft) — preselects the closest slot.
  const [target, setTarget] = useState<{ time: string | null; window: TimeWindow | null } | null>(null);
  // The call assistant is optional; hiding it is remembered per browser.
  const [assistOn, setAssistOn] = useState(() => FEATURES.callAssist && !readPref(PREF_HIDDEN));

  const service = services.find((s) => s.id === serviceId) ?? null;
  const eligibleStaff = useMemo(() => (service ? eligibleStaffForServices(staff, [service]) : []), [staff, service]);

  const today = useMemo(() => todayInZone(timezone), [timezone]);
  const maxDate = useMemo(() => addDays(addMonths(today, WINDOW_MONTHS), -1), [today]);
  const windowDays = useMemo(() => daysBetween(today, maxDate) + 1, [today, maxDate]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ service_ids: serviceId });
    if (staffId) params.set("staff_id", staffId);
    if (locationId) params.set("location_id", locationId);
    return params.toString();
  }, [serviceId, staffId, locationId]);

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    const chunks: Promise<Slot[]>[] = [];
    for (let off = 0; off < windowDays; off += CHUNK_DAYS) {
      const days = Math.min(CHUNK_DAYS, windowDays - off);
      chunks.push(
        fetch(`/api/widgets/${instanceId}/availability?${query}&from=${addDays(today, off)}&days=${days}`).then(
          async (res) => {
            if (!res.ok) throw new Error(String(res.status));
            return ((await res.json()).slots ?? []) as Slot[];
          },
        ),
      );
    }
    Promise.all(chunks)
      .then((parts) => {
        if (!cancelled) setResult({ query, slots: parts.flat(), error: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ query, slots: [], error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [instanceId, serviceId, query, today, windowDays]);

  const loading = !!serviceId && result?.query !== query;
  const slots = useMemo(() => (loading ? [] : (result?.slots ?? [])), [loading, result]);
  const error = !loading && !!result?.error;

  const fmt = useMemo(
    () => ({
      key: new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }),
      weekday: new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short" }),
      dayNum: new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric" }),
      month: new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "short" }),
      day: new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }),
      time: new Intl.DateTimeFormat(locale, { timeZone: timezone, hour: "numeric", minute: "2-digit" }),
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

  const stripDays = useMemo(() => Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i)), [today]);
  const availableDates = useMemo(() => new Set(slotsByDate.keys()), [slotsByDate]);
  const firstFree = useMemo(() => [...availableDates].sort()[0] ?? null, [availableDates]);
  const activeDate = pickedDate ?? firstFree ?? today;
  const daySlots = useMemo(() => slotsByDate.get(activeDate) ?? [], [slotsByDate, activeDate]);
  const label = (key: string) => fmt.day.format(new Date(`${key}T12:00:00Z`));

  // The free time closest to what the caller asked for, on the active day.
  const suggestedSlot = useMemo(() => {
    if (!target || daySlots.length === 0) return null;
    const minutes = (s: Slot) => {
      const [h, m] = fmt.hm.format(new Date(s.start)).split(":").map(Number);
      return h * 60 + m;
    };
    if (target.time) {
      const [h, m] = target.time.split(":").map(Number);
      const want = h * 60 + m;
      return daySlots.reduce((best, s) => (Math.abs(minutes(s) - want) < Math.abs(minutes(best) - want) ? s : best));
    }
    if (target.window) {
      const [from, to] =
        target.window === "morning" ? [0, 720] : target.window === "afternoon" ? [720, 1020] : [1020, 1440];
      return daySlots.find((s) => minutes(s) >= from && minutes(s) < to) ?? null;
    }
    return null;
  }, [target, daySlots, fmt]);
  const slot = pickedSlot ?? suggestedSlot;
  // The side column shows while the assistant is on or a time is picked.
  const showSide = assistOn || !!slot;

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
                    const active = slot?.start === s.start;
                    return (
                      <button
                        key={s.start}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setPickedSlot(active ? null : s);
                          setTarget(null);
                        }}
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

  function applyDraft(d: CallDraft) {
    const svc = d.service_ids.find((id) => services.some((s) => s.id === id));
    if (svc) setServiceId(svc);
    setStaffId(d.staff_id ?? "");
    if (d.date && d.date >= today && d.date <= maxDate) setPickedDate(d.date);
    setPickedSlot(null);
    setTarget(d.time || d.time_window ? { time: d.time, window: d.time_window } : null);
  }

  return (
    <div className="-mx-6 -mb-6 max-h-[75vh] overflow-y-auto border-t border-border">
      {FEATURES.callAssist && !assistOn && (
        <AssistHiddenBanner
          onShow={() => {
            setAssistOn(true);
            writePref(PREF_HIDDEN, false);
          }}
        />
      )}
      <div className={cn(showSide && "lg:grid lg:grid-cols-5")}>
        {/* Availability */}
        <div className={cn("space-y-5 p-6", showSide && "lg:col-span-3")}>
          <p className="text-sm text-muted-foreground">{tt.availSubtitle}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{tt.availService}</span>
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
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{tt.availStaff}</span>
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
                  <span className="text-muted-foreground">{tt.availFirstFree} </span>
                  <span className="font-semibold first-letter:uppercase">
                    {label(firstFree)}, {fmt.time.format(new Date(slotsByDate.get(firstFree)![0].start))}
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
                    view === v ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v === "days" ? tt.availViewDays : tt.availViewMonth}
                </button>
              ))}
            </div>
          </div>

          {!service ? (
            <p className="text-sm text-muted-foreground">{tt.availNoServices}</p>
          ) : error ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{tt.availError}</p>
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
                      <div key={i} className="h-[68px] animate-pulse rounded-xl bg-muted" />
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

        {/* Call assistant + booking details */}
        {showSide && (
          <SidePanel
            instanceId={instanceId}
            locationId={locationId}
            serviceId={service?.id ?? null}
            serviceName={service?.name ?? null}
            staffId={staffId}
            staffName={staff.find((m) => m.id === staffId)?.name ?? null}
            slot={slot}
            slotLabel={
              slot ? `${label(fmt.key.format(new Date(slot.start)))}, ${fmt.time.format(new Date(slot.start))}` : null
            }
            assistOn={assistOn}
            onHideAssist={() => {
              setAssistOn(false);
              writePref(PREF_HIDDEN, true);
            }}
            onDraft={applyDraft}
          />
        )}
      </div>
    </div>
  );
}

// Per-viewer UI preferences (assistant hidden, auto-record). Storage can be
// unavailable (private mode), so every access is guarded.
const PREF_HIDDEN = "callAssist:hidden";
const PREF_AUTORECORD = "callAssist:autoRecord";
function readPref(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function writePref(key: string, on: boolean) {
  try {
    window.localStorage.setItem(key, on ? "1" : "0");
  } catch {
    // ignore
  }
}

// Right-hand column: the optional call assistant (recorder) on top, and the
// booking details once a time is picked (or the call produced a draft).
function SidePanel({
  instanceId,
  locationId,
  serviceId,
  serviceName,
  staffName,
  staffId,
  slot,
  slotLabel,
  assistOn,
  onHideAssist,
  onDraft,
}: {
  instanceId: string;
  locationId: string | null;
  serviceId: string | null;
  serviceName: string | null;
  staffName: string | null;
  staffId: string;
  slot: Slot | null;
  slotLabel: string | null;
  assistOn: boolean;
  onHideAssist: () => void;
  onDraft: (d: CallDraft) => void;
}) {
  const { t, locale } = useLanguage();
  const tt = t.bookingToday;
  const [state, setState] = useState<CallState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [autoRecord, setAutoRecord] = useState(() => readPref(PREF_AUTORECORD));

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audio = useRef<Blob | null>(null);
  const teardown = useRef<(() => void) | null>(null);

  // Release the mic if the modal closes mid-call.
  useEffect(() => () => teardown.current?.(), []);

  // "Record when opened": start as soon as the modal mounts (the click that
  // opened it counts as the user gesture for the mic prompt).
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || !assistOn || !readPref(PREF_AUTORECORD)) return;
    autoStarted.current = true;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(tt.callErrorMic);
      return;
    }
    setError(null);
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) =>
      MediaRecorder.isTypeSupported(m),
    );
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    rec.onstop = () => {
      audio.current = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
    };
    rec.start(1000);
    recorder.current = rec;

    // Live input level for the waveform.
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let raf = 0;
    let lastPush = 0;
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (ts - lastPush < 90) return;
      lastPush = ts;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      const rms = Math.min(1, Math.sqrt(sum / buf.length) * 4);
      setLevels((l) => [...l.slice(1), rms]);
    };
    raf = requestAnimationFrame(loop);

    setSeconds(0);
    let elapsed = 0;
    const tick = setInterval(() => {
      elapsed += 1;
      setSeconds(elapsed);
      if (elapsed >= MAX_RECORDING_S) stop();
    }, 1000);

    teardown.current = () => {
      clearInterval(tick);
      cancelAnimationFrame(raf);
      if (rec.state !== "inactive") rec.stop();
      stream.getTracks().forEach((tr) => tr.stop());
      void ctx.close();
      teardown.current = null;
    };
    setState("recording");
  }

  function stop() {
    teardown.current?.();
    setLevels(Array(BARS).fill(0));
    setState("recorded");
  }

  async function process() {
    if (!audio.current) return;
    setState("processing");
    setError(null);
    const ext = audio.current.type.includes("mp4") ? "mp4" : "webm";
    const body = new FormData();
    body.append("audio", audio.current, `call.${ext}`);
    if (locationId) body.append("location_id", locationId);
    body.append("locale", locale);
    let data: { transcript: string; draft: CallDraft | null } | null = null;
    try {
      const res = await fetch(`/api/widgets/${instanceId}/call-booking`, { method: "POST", body });
      if (res.ok) data = await res.json();
    } catch {
      // handled below
    }
    if (!data) {
      setError(tt.callErrorProcess);
      setState("recorded");
      return;
    }
    setTranscript(data.transcript);
    if (!data.draft) {
      setError(tt.callErrorEmpty);
      setState("recorded");
      return;
    }
    const d = data.draft;
    setSummary(d.summary);
    // Keep anything the owner already typed; fill the blanks from the call.
    setForm((f) => ({
      name: f.name || d.customer_name || "",
      phone: f.phone || d.customer_phone || "",
      email: f.email || d.customer_email || "",
      notes: f.notes || d.notes || "",
    }));
    onDraft(d);
    setState("draft");
  }

  async function book() {
    if (!serviceId || !slot) return;
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
        const key = BOOKING_ERROR_KEYS[data.error as string] as keyof typeof t.booking | undefined;
        setError(key ? t.booking[key] : t.booking.errorGeneric);
        return;
      }
      setState("booked");
    } catch {
      setError(t.booking.errorBookingFailed);
    } finally {
      setSubmitting(false);
    }
  }

  // Drop the recording (and its draft), keep what the owner typed.
  function resetRecording() {
    teardown.current?.();
    audio.current = null;
    setSeconds(0);
    setLevels(Array(BARS).fill(0));
    setError(null);
    setTranscript("");
    setSummary("");
    setState("idle");
  }

  function newCall() {
    resetRecording();
    setForm({ name: "", phone: "", email: "", notes: "" });
  }

  function hideAssist() {
    resetRecording();
    onHideAssist();
  }

  function toggleAutoRecord(on: boolean) {
    setAutoRecord(on);
    writePref(PREF_AUTORECORD, on);
  }

  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const busy = state === "recording" || state === "recorded" || state === "processing";
  const showDetails = state === "draft" || (!!slot && state !== "booked");
  // With a time already picked and nothing recorded, the recorder shrinks to a
  // one-line bar so the details get the room.
  const compactRecorder = !!slot && state === "idle";
  const field =
    "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (state === "booked") {
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
      {assistOn && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-semibold">{tt.callTitle}</h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              {tt.callPrototypeBadge}
            </span>
            <button
              type="button"
              onClick={hideAssist}
              aria-label={tt.callHide}
              title={tt.callHide}
              className="ml-auto rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {state === "draft" ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-emerald-600" /> {tt.callRecorded} · {clock}
              </span>
              <button
                type="button"
                onClick={resetRecording}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {tt.callDiscard}
              </button>
            </div>
          ) : compactRecorder ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2">
              <span className="text-xs text-muted-foreground">{tt.callCompactHint}</span>
              <button
                type="button"
                onClick={start}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
              >
                <Mic className="h-3.5 w-3.5" /> {tt.callRecord}
              </button>
            </div>
          ) : (
            <>
              {!busy && <p className="text-sm text-muted-foreground">{tt.callHint}</p>}
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-background px-4 py-6">
                <div aria-hidden className="flex h-10 items-center gap-1">
                  {levels.map((v, i) => (
                    <span
                      key={i}
                      className={cn(
                        "w-1 rounded-full transition-[height] duration-100",
                        state === "recording" ? "bg-rose-500" : "bg-border",
                      )}
                      style={{ height: `${Math.max(10, v * 100)}%` }}
                    />
                  ))}
                </div>
                <span className="text-2xl font-bold tabular-nums tracking-tight">{clock}</span>
                {state === "recording" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                    <span className="h-2 w-2 rounded-full bg-current motion-safe:animate-pulse" /> {tt.callRecording}
                  </span>
                ) : state === "recorded" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Check className="h-3.5 w-3.5" /> {tt.callRecorded}
                  </span>
                ) : null}

                {state === "idle" && (
                  <button
                    type="button"
                    onClick={start}
                    className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
                  >
                    <Mic className="h-4 w-4" /> {tt.callRecord}
                  </button>
                )}
                {state === "recording" && (
                  <button
                    type="button"
                    onClick={stop}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition hover:bg-muted"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" /> {tt.callStop}
                  </button>
                )}
                {(state === "recorded" || state === "processing") && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={process}
                      disabled={state === "processing"}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70"
                    >
                      {state === "processing" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                      {state === "processing" ? tt.callProcessing : tt.callProcess}
                    </button>
                    {state === "recorded" && (
                      <button
                        type="button"
                        onClick={resetRecording}
                        className="rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                      >
                        {tt.callDiscard}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {!showDetails && error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
              {transcript && state === "recorded" && <Transcript text={transcript} />}
              <p className="text-xs text-muted-foreground">
                {tt.callSpeakerHint} {tt.callConsent}
              </p>
            </>
          )}

          {!busy && state !== "draft" && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={autoRecord}
                onChange={(e) => toggleAutoRecord(e.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-600"
              />
              {tt.callAutoRecord}
            </label>
          )}
        </section>
      )}

      {showDetails && (
        <section className={cn("space-y-4", assistOn && "border-t border-border pt-5")}>
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-semibold">{state === "draft" ? tt.callDraftTitle : tt.detailsTitle}</h3>
              <p className="text-xs text-muted-foreground">{summary || tt.detailsHint}</p>
            </div>
          </div>

          <dl className="divide-y divide-border rounded-xl border border-border bg-background text-sm">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <dt className="text-muted-foreground">{tt.availService}</dt>
              <dd className="text-right font-medium">{serviceName ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <dt className="text-muted-foreground">{tt.availStaff}</dt>
              <dd className="text-right font-medium">{staffName ?? tt.availAnyStaff}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <dt className="text-muted-foreground">{tt.callDraftWhen}</dt>
              <dd
                className={cn(
                  "flex items-center gap-1.5 text-right first-letter:uppercase",
                  slotLabel ? "font-medium" : "text-muted-foreground",
                )}
              >
                {slotLabel && <CalendarDays className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                {slotLabel ?? tt.callPickSlot}
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

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

          <button
            type="button"
            onClick={book}
            disabled={submitting || !slot || !serviceId}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {tt.callConfirm}
          </button>

          {transcript && state === "draft" && <Transcript text={transcript} />}
        </section>
      )}
    </aside>
  );
}

// Shown in place of the assistant when the owner hid it.
function AssistHiddenBanner({ onShow }: { onShow: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-6 py-2 text-xs text-muted-foreground">
      <Mic className="h-3.5 w-3.5" />
      <span>{t.bookingToday.callHiddenBanner}</span>
      <button
        type="button"
        onClick={onShow}
        className="ml-auto font-medium text-emerald-700 hover:underline dark:text-emerald-300"
      >
        {t.bookingToday.callShow}
      </button>
    </div>
  );
}

function Transcript({ text }: { text: string }) {
  const { t } = useLanguage();
  return (
    <details className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        {t.bookingToday.callTranscript}
      </summary>
      <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{text}</p>
    </details>
  );
}

const BARS = 24;

function addMonths(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, d, 12)).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}
