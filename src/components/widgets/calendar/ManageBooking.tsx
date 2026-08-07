"use client";

import { useState } from "react";
import { CalendarDays, Clock, User, X } from "lucide-react";
import type { Slot } from "@/lib/widgets/calendar";
import { ReschedulePicker } from "./ReschedulePicker";
import { useLanguage } from "@/contexts/LanguageContext";

export type ManageBookingData = {
  service_name: string;
  service_id: string;
  location_id: string | null;
  instance_id: string;
  starts_at: string;
  status: "confirmed" | "cancelled";
  business_name: string;
  business_username: string | null;
  timezone: string;
  // Assigned specialist, when the instance uses staff. Null ⇒ nothing shown.
  staff_name?: string | null;
};

export function ManageBooking({ token, initial }: { token: string; initial: ManageBookingData }) {
  const { t, locale } = useLanguage();
  const [booking, setBooking] = useState(initial);
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tz = booking.timezone;
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));

  async function reschedule(slot: Slot, staffId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/widgets/bookings/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starts_at: slot.start, staff_id: staffId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(t.booking.errorReschedule);
        return;
      }
      setBooking({ ...booking, starts_at: data.starts_at, staff_name: data.staff_name ?? null });
      setMode("view");
    } catch {
      setError(t.booking.errorReschedule);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!confirm(t.booking.confirmCancelBooking)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/widgets/bookings/${token}`, { method: "DELETE" });
      if (!res.ok) {
        setError(t.booking.errorCancel);
        return;
      }
      setBooking({ ...booking, status: "cancelled" });
      setMode("view");
    } catch {
      setError(t.booking.errorCancel);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">{t.booking.yourBooking}</h1>
            <p className="text-sm text-muted-foreground">
              {t.booking.withBusiness.replace("{business}", booking.business_name)}
            </p>
          </div>
        </div>

        {booking.status === "cancelled" ? (
          <div className="mt-6 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            {t.booking.cancelledNotice}
          </div>
        ) : (
          <div className="mt-6 space-y-1">
            <p className="text-sm text-muted-foreground">{booking.service_name}</p>
            <p className="flex items-center gap-2 text-base font-medium">
              <Clock className="h-4 w-4 text-muted-foreground" /> {fmt(booking.starts_at)}
            </p>
            {booking.staff_name && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" /> {t.booking.withName.replace("{name}", booking.staff_name)}
              </p>
            )}
          </div>
        )}

        {error && mode === "view" && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        {booking.status === "confirmed" && mode === "view" && (
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => {
                setError(null);
                setMode("reschedule");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted"
            >
              <CalendarDays className="h-4 w-4" /> {t.booking.reschedule}
            </button>
            <button
              onClick={cancel}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:hover:bg-red-950/30"
            >
              <X className="h-4 w-4" /> {t.booking.cancel}
            </button>
          </div>
        )}

        {mode === "reschedule" && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t.booking.pickNewTime}</h2>
              <button
                onClick={() => setMode("view")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t.booking.cancel}
              </button>
            </div>
            <ReschedulePicker
              instanceId={booking.instance_id}
              serviceId={booking.service_id}
              locationId={booking.location_id}
              timezone={tz}
              busy={busy}
              error={error}
              onPick={reschedule}
            />
          </div>
        )}
      </div>

      {booking.business_username && (
        <p className="mt-4 text-center text-sm">
          <a href={`/${booking.business_username}`} className="text-emerald-600 hover:underline">
            {t.booking.backToBusiness.replace("{business}", booking.business_name)}
          </a>
        </p>
      )}
    </div>
  );
}
