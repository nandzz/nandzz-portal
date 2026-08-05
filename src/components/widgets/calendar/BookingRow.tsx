"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle, Ban, CalendarClock, Loader2 } from "lucide-react";
import { whatsappLink } from "@/lib/widgets/contact";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { ReschedulePicker } from "./ReschedulePicker";
import type { Slot } from "@/lib/widgets/calendar";

export type BookingRowData = {
  id: string;
  instance_id: string;
  service_id: string;
  customer_name: string;
  customer_email: string;
  service_name: string;
  starts_at: string; // ISO
  price_cents: number | null;
  status: "confirmed" | "cancelled";
  customer_phone: string | null;
  staff_id: string | null;
  staff_name: string | null;
  manage_token: string;
};

export function BookingRow({
  b,
  money,
  fmt,
  timezone,
  dim,
  cancellable,
}: {
  b: BookingRowData;
  money: (cents: number) => string;
  fmt: (iso: string) => string;
  timezone: string; // IANA tz — the reschedule picker renders slots in it
  dim?: boolean;
  cancellable?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const when = fmt(b.starts_at);
  const firstName = b.customer_name.split(" ")[0] || b.customer_name;
  const wa = b.customer_phone
    ? whatsappLink(
        b.customer_phone,
        `Hi ${firstName} 👋 — about your ${b.service_name} booking on ${when}:`
      )
    : null;

  async function reschedule(slot: Slot) {
    setBusy(true);
    setRescheduleError(null);
    try {
      const res = await fetch(`/api/widgets/bookings/${b.manage_token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starts_at: slot.start }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRescheduleError(data.error ?? "Could not reschedule this booking.");
        return;
      }
      setRescheduling(false);
      router.refresh(); // re-run the server page → tiles, chart & lists all update
    } catch {
      setRescheduleError("Could not reschedule this booking.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!confirm(`Cancel ${b.customer_name}'s ${b.service_name} booking on ${when}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/widgets/bookings/${b.manage_token}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Could not cancel this booking.");
        return;
      }
      router.refresh(); // re-run the server page → tiles, chart & lists all update
    } catch {
      alert("Could not cancel this booking.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex items-center justify-between gap-3 px-5 py-3.5 ${dim ? "opacity-70" : ""}`}>
      <div className="min-w-0">
        <p className="truncate font-medium">{b.customer_name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {b.service_name} · {when}
        </p>
        {b.staff_name && (
          <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Avatar size="sm" className="h-4 w-4">
              <AvatarImage src={undefined} />
              <AvatarFallback className="text-[9px]">
                {b.staff_name[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            {b.staff_name}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {b.status === "cancelled" && (
          <span className="mr-1 rounded-full bg-muted px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
            Cancelled
          </span>
        )}
        {b.price_cents != null && b.price_cents > 0 && (
          <span className="mr-1 hidden text-sm font-medium tabular-nums sm:inline">{money(b.price_cents)}</span>
        )}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/30"
            aria-label={`WhatsApp ${b.customer_name}`}
            title="Message on WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        )}
        <a
          href={`mailto:${b.customer_email}`}
          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label={`Email ${b.customer_name}`}
          title="Send email"
        >
          <Mail className="h-4 w-4" />
        </a>
        {cancellable && (
          <button
            onClick={() => {
              setRescheduleError(null);
              setRescheduling(true);
            }}
            disabled={busy}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50 dark:hover:bg-emerald-950/30"
            aria-label={`Reschedule ${b.customer_name}'s booking`}
            title="Reschedule booking"
          >
            <CalendarClock className="h-4 w-4" />
          </button>
        )}
        {cancellable && (
          <button
            onClick={cancel}
            disabled={busy}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30"
            aria-label={`Cancel ${b.customer_name}'s booking`}
            title="Cancel booking"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
          </button>
        )}
      </div>

      <Dialog
        open={rescheduling}
        onClose={() => setRescheduling(false)}
        title={`Reschedule — ${b.customer_name}`}
      >
        <p className="mb-4 text-sm text-muted-foreground">
          {b.service_name} · currently {when}
        </p>
        <ReschedulePicker
          instanceId={b.instance_id}
          serviceId={b.service_id}
          timezone={timezone}
          busy={busy}
          error={rescheduleError}
          onPick={reschedule}
        />
      </Dialog>
    </div>
  );
}
