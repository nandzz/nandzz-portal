"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarClock, Clock, Loader2, MapPin, Users } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { whatsappLink } from "@/lib/widgets/contact";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { ReschedulePicker } from "./ReschedulePicker";
import { AssignStaffDialog } from "./AssignStaffDialog";
import type { Slot } from "@/lib/widgets/calendar";
import type { BookingServiceSnapshot } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

export type BookingRowData = {
  id: string;
  instance_id: string;
  service_id: string;
  customer_name: string;
  customer_email: string;
  service_name: string;
  starts_at: string; // ISO
  ends_at: string; // ISO — reserved span end, drives the in-progress/completed tag
  price_cents: number | null;
  status: "confirmed" | "cancelled";
  customer_phone: string | null;
  customer_address?: string | null;
  staff_id: string | null;
  staff_name: string | null;
  // Per-service staff breakdown (multi-service bookings); null ⇒ single service
  // described by the aggregate staff_id/staff_name.
  services?: BookingServiceSnapshot[] | null;
  location_id: string | null;
  manage_token: string;
};

// Chronological status pill shown above the customer name. Each category gets
// its own colour so the owner can scan the list at a glance. Classes cover both
// light and dark themes.
const TAG_STYLES = {
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  completed: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  inProgress: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  soon: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  today: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  tomorrow: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
} as const;

const HOUR_MS = 3_600_000;

export function BookingRow({
  b,
  money,
  fmt,
  timezone,
  now,
  dim,
  cancellable,
  hasStaff = false,
}: {
  b: BookingRowData;
  money: (cents: number) => string;
  fmt: (iso: string) => string;
  timezone: string; // IANA tz — the reschedule picker renders slots in it + tag day math
  now: number; // reference "now" (ms) the chronological tag is computed against
  dim?: boolean;
  cancellable?: boolean;
  // Whether the instance has any staff — gates the "Assign staff" action. The
  // dialog itself fetches the full roster + availability from the server.
  hasStaff?: boolean;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  // The booked services with their assigned staff: the per-service breakdown
  // when present, else the single aggregate line. Drives the row's staff display.
  const bookedServices: { service_id: string; name: string; staff_id: string | null; staff_name: string | null }[] =
    b.services && b.services.length > 0
      ? b.services.map((s) => ({
          service_id: s.service_id,
          name: s.name,
          staff_id: s.staff_id ?? null,
          staff_name: s.staff_name ?? null,
        }))
      : [{ service_id: b.service_id, name: b.service_name, staff_id: b.staff_id, staff_name: b.staff_name }];

  const anyStaff = bookedServices.some((s) => s.staff_name);
  const canReassign = Boolean(cancellable) && hasStaff;

  const when = fmt(b.starts_at);
  const firstName = b.customer_name.split(" ")[0] || b.customer_name;

  // Single chronological status tag, resolved by priority against `now`:
  // cancelled → in progress → completed → imminent countdown (≤4h) → today →
  // tomorrow → (nothing, for further-out dates the time pill already shows).
  const tag = useMemo<{ label: string; className: string; live?: boolean } | null>(() => {
    const start = new Date(b.starts_at).getTime();
    const end = new Date(b.ends_at).getTime();
    if (b.status === "cancelled")
      return { label: t.booking.tagCancelled, className: TAG_STYLES.cancelled };
    if (now >= start && now < end)
      return { label: t.booking.tagInProgress, className: TAG_STYLES.inProgress, live: true };
    if (now >= end)
      return { label: t.booking.tagCompleted, className: TAG_STYLES.completed };

    const delta = start - now; // upcoming
    if (delta <= 4 * HOUR_MS) {
      if (delta < HOUR_MS) {
        const n = Math.max(1, Math.ceil(delta / 60_000));
        return { label: t.booking.tagInMinutes.replace("{n}", String(n)), className: TAG_STYLES.soon };
      }
      const n = Math.min(4, Math.max(1, Math.round(delta / HOUR_MS)));
      const label = n === 1 ? t.booking.tagInHour : t.booking.tagInHours.replace("{n}", String(n));
      return { label, className: TAG_STYLES.soon };
    }

    // Beyond the countdown window: is it (in the widget's timezone) today or
    // tomorrow? Otherwise no tag — the date pill already carries that info.
    const dayFmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const startKey = dayFmt.format(new Date(start));
    if (startKey === dayFmt.format(new Date(now)))
      return { label: t.booking.tagToday, className: TAG_STYLES.today };
    if (startKey === dayFmt.format(new Date(now + 24 * HOUR_MS)))
      return { label: t.booking.tagTomorrow, className: TAG_STYLES.tomorrow };
    return null;
  }, [b.starts_at, b.ends_at, b.status, now, timezone, t]);

  const wa = b.customer_phone
    ? whatsappLink(
        b.customer_phone,
        t.booking.whatsappGreeting
          .replace("{name}", firstName)
          .replace("{service}", b.service_name)
          .replace("{when}", when)
      )
    : null;

  async function reschedule(slot: Slot, staffByService: Record<string, string>) {
    setBusy(true);
    setRescheduleError(null);
    try {
      const res = await fetch(`/api/widgets/bookings/${b.manage_token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starts_at: slot.start, staff_by_service: staffByService }),
      });
      if (!res.ok) {
        setRescheduleError(t.booking.errorRescheduleThis);
        return;
      }
      setRescheduling(false);
      router.refresh(); // re-run the server page → tiles, chart & lists all update
    } catch {
      setRescheduleError(t.booking.errorRescheduleThis);
    } finally {
      setBusy(false);
    }
  }


  async function cancel() {
    if (
      !confirm(
        t.booking.confirmCancelThis
          .replace("{name}", b.customer_name)
          .replace("{service}", b.service_name)
          .replace("{when}", when)
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/widgets/bookings/${b.manage_token}`, { method: "DELETE" });
      if (!res.ok) {
        // Never surface the raw API error body; show localized copy only.
        alert(t.booking.errorCancelThis);
        return;
      }
      router.refresh(); // re-run the server page → tiles, chart & lists all update
    } catch {
      alert(t.booking.errorCancelThis);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 px-5 py-3.5 ${dim ? "opacity-70" : ""}`}
    >
      <div className="min-w-0">
        {tag && (
          <span
            className={`mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tag.className}`}
          >
            {tag.live && (
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" aria-hidden />
            )}
            {tag.label}
          </span>
        )}
        <p className="truncate font-medium">{b.customer_name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm text-muted-foreground">{b.service_name}</p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Clock className="h-3 w-3" />
            {when}
          </span>
        </div>
        {anyStaff && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {bookedServices
              .filter((s) => s.staff_name)
              .map((s) => (
                <span
                  key={s.service_id}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Avatar size="sm" className="h-4 w-4">
                    <AvatarFallback className="text-[9px]">
                      {s.staff_name![0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  {bookedServices.length > 1 ? `${s.name}: ${s.staff_name}` : s.staff_name}
                </span>
              ))}
          </div>
        )}
        {b.customer_address && (
          <span className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="break-words">{b.customer_address}</span>
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {b.price_cents != null && b.price_cents > 0 && (
          <span className="mr-1 hidden text-sm font-medium tabular-nums sm:inline">{money(b.price_cents)}</span>
        )}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/30"
            aria-label={t.booking.whatsappAria.replace("{name}", b.customer_name)}
            title={t.booking.whatsappTitle}
          >
            <WhatsAppIcon className="h-4 w-4" />
          </a>
        )}
        {canReassign && (
          <button
            onClick={() => setAssigning(true)}
            disabled={busy}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50 dark:hover:bg-emerald-950/30"
            aria-label={t.booking.assignStaff}
            title={t.booking.assignStaff}
          >
            <Users className="h-4 w-4" />
          </button>
        )}
        {cancellable && (
          <button
            onClick={() => {
              setRescheduleError(null);
              setRescheduling(true);
            }}
            disabled={busy}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50 dark:hover:bg-emerald-950/30"
            aria-label={t.booking.rescheduleAria.replace("{name}", b.customer_name)}
            title={t.booking.rescheduleTitle}
          >
            <CalendarClock className="h-4 w-4" />
          </button>
        )}
        {cancellable && (
          <button
            onClick={cancel}
            disabled={busy}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30"
            aria-label={t.booking.cancelAria.replace("{name}", b.customer_name)}
            title={t.booking.cancelTitle}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
          </button>
        )}
      </div>

      <Dialog
        open={rescheduling}
        onClose={() => setRescheduling(false)}
        title={t.booking.rescheduleDialogTitle.replace("{name}", b.customer_name)}
      >
        <p className="mb-4 text-sm text-muted-foreground">
          {t.booking.rescheduleDialogSubtitle
            .replace("{service}", b.service_name)
            .replace("{when}", when)}
        </p>
        <ReschedulePicker
          token={b.manage_token}
          timezone={timezone}
          busy={busy}
          error={rescheduleError}
          onPick={reschedule}
        />
      </Dialog>

      <AssignStaffDialog
        token={b.manage_token}
        timezone={timezone}
        open={assigning}
        onClose={() => setAssigning(false)}
        onDone={() => router.refresh()}
      />
    </div>
  );
}
