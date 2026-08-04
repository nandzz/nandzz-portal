"use client";

import { useState } from "react";
import { Loader2, CalendarDays, Clock, Check, X } from "lucide-react";
import type { Slot } from "@/lib/widgets/calendar";

export type ManageBookingData = {
  service_name: string;
  service_id: string;
  instance_id: string;
  starts_at: string;
  status: "confirmed" | "cancelled";
  business_name: string;
  business_username: string | null;
  timezone: string;
};

export function ManageBooking({ token, initial }: { token: string; initial: ManageBookingData }) {
  const [booking, setBooking] = useState(initial);
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tz = booking.timezone;
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  const fmtDay = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(
      new Date(iso)
    );
  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  async function startReschedule() {
    setMode("reschedule");
    setLoadingSlots(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/widgets/${booking.instance_id}/availability?service_id=${encodeURIComponent(
          booking.service_id
        )}&days=14`
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

  async function reschedule(slot: Slot) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/widgets/bookings/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starts_at: slot.start }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not reschedule.");
        return;
      }
      setBooking({ ...booking, starts_at: data.starts_at });
      setMode("view");
    } catch {
      setError("Could not reschedule.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!confirm("Cancel this booking?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/widgets/bookings/${token}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not cancel.");
        return;
      }
      setBooking({ ...booking, status: "cancelled" });
      setMode("view");
    } catch {
      setError("Could not cancel.");
    } finally {
      setBusy(false);
    }
  }

  const byDay = new Map<string, Slot[]>();
  for (const s of slots) {
    const key = fmtDay(s.start);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(s);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Your booking</h1>
            <p className="text-sm text-muted-foreground">with {booking.business_name}</p>
          </div>
        </div>

        {booking.status === "cancelled" ? (
          <div className="mt-6 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            This booking has been cancelled.
          </div>
        ) : (
          <div className="mt-6 space-y-1">
            <p className="text-sm text-muted-foreground">{booking.service_name}</p>
            <p className="flex items-center gap-2 text-base font-medium">
              <Clock className="h-4 w-4 text-muted-foreground" /> {fmt(booking.starts_at)}
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        {booking.status === "confirmed" && mode === "view" && (
          <div className="mt-6 flex gap-2">
            <button
              onClick={startReschedule}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted"
            >
              <CalendarDays className="h-4 w-4" /> Reschedule
            </button>
            <button
              onClick={cancel}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:hover:bg-red-950/30"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        )}

        {mode === "reschedule" && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Pick a new time</h2>
              <button onClick={() => setMode("view")} className="text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            </div>
            {loadingSlots ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open slots in the next two weeks.</p>
            ) : (
              <div className="space-y-4">
                {[...byDay.entries()].map(([day, daySlots]) => (
                  <div key={day}>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">{day}</p>
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map((s) => (
                        <button
                          key={s.start}
                          disabled={busy}
                          onClick={() => reschedule(s)}
                          className="rounded-lg border border-border px-3 py-1.5 text-sm transition hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-60 dark:hover:bg-emerald-950/30"
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
      </div>

      {booking.business_username && (
        <p className="mt-4 text-center text-sm">
          <a href={`/${booking.business_username}`} className="text-emerald-600 hover:underline">
            ← Back to {booking.business_name}
          </a>
        </p>
      )}
    </div>
  );
}
