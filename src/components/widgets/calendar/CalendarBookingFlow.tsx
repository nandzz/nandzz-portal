"use client";

import { useEffect, useState } from "react";
import { Clock, Loader2, Check, ChevronLeft } from "lucide-react";
import type { CalendarService } from "@/lib/types";
import type { Slot } from "@/lib/widgets/calendar";

interface Props {
  instanceId: string;
  services: CalendarService[];
  timezone: string;
  businessName: string;
  initialServiceId?: string;
  onBooked?: (manageUrl: string) => void;
}

type Step = "service" | "slot" | "details" | "done";

export function CalendarBookingFlow({
  instanceId,
  services,
  timezone,
  businessName,
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
  const [slot, setSlot] = useState<Slot | null>(null);
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

  async function loadSlots(s: CalendarService) {
    setLoadingSlots(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/widgets/${instanceId}/availability?service_id=${encodeURIComponent(s.id)}&days=14`
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
    setStep("slot");
    await loadSlots(s);
  }

  async function submit() {
    if (!service || !slot) return;
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
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
          customer_name: form.name,
          customer_email: form.email,
          customer_phone: form.phone || undefined,
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

  // Group slots by day for display.
  const byDay = new Map<string, Slot[]>();
  for (const s of slots) {
    const key = fmtDay(s.start);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(s);
  }

  const back = () => {
    setError(null);
    if (step === "details") setStep("slot");
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
        <p className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2 text-sm text-red-700 dark:text-red-300">
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
                {typeof s.price_cents === "number" && s.price_cents > 0 && (
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

      {/* Step 2 — slot */}
      {step === "slot" && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Pick a time · {service?.name}</h3>
          {loadingSlots ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading availability…
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open slots in the next two weeks.</p>
          ) : (
            <div className="space-y-4">
              {[...byDay.entries()].map(([day, daySlots]) => (
                <div key={day}>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">{day}</p>
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map((s) => (
                      <button
                        key={s.start}
                        onClick={() => {
                          setSlot(s);
                          setStep("details");
                        }}
                        className="rounded-lg border border-border px-3 py-1.5 text-sm transition hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      >
                        {fmtTime(s.start)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — details */}
      {step === "details" && slot && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Your details</h3>
          <p className="text-sm text-muted-foreground">
            {service?.name} · {fmtDay(slot.start)} at {fmtTime(slot.start)}
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
            placeholder="Phone (optional)"
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

      {/* Step 4 — done */}
      {step === "done" && (
        <div className="space-y-3 text-center py-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-base font-semibold">You&apos;re booked!</h3>
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
