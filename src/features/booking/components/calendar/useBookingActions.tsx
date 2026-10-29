"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { ReschedulePicker } from "./ReschedulePicker";
import { AssignStaffDialog } from "./AssignStaffDialog";
import type { Slot } from "@/features/booking/domain/calendar";
import { useLanguage } from "@/contexts/LanguageContext";

// The owner's actions on one booking — reschedule (date, time, services and
// staff), reassign staff, cancel — shared by every surface that shows a
// booking (the Bookings list/calendar rows and the Today focus panel) so they
// stay identical. Returns the triggers plus the dialogs to render once.

type ActionBooking = {
  manage_token: string;
  customer_name: string;
  service_name: string;
};

export function useBookingActions({
  b,
  when,
  timezone,
  onChanged,
}: {
  b: ActionBooking;
  when: string; // the booking's formatted date/time, for confirm + dialog copy
  timezone: string; // IANA tz the reschedule picker renders slots in
  // Called after a successful change so the caller can refetch its data;
  // defaults to refreshing the server-rendered page.
  onChanged?: () => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const changed = () => (onChanged ? onChanged() : router.refresh());

  async function reschedule(slot: Slot, staffByService: Record<string, string>, serviceIds?: string[]) {
    setBusy(true);
    setRescheduleError(null);
    try {
      const res = await fetch(`/api/widgets/bookings/${b.manage_token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          starts_at: slot.start,
          staff_by_service: staffByService,
          service_ids: serviceIds,
        }),
      });
      if (!res.ok) {
        setRescheduleError(t.booking.errorRescheduleThis);
        return;
      }
      setRescheduling(false);
      changed();
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
      changed();
    } catch {
      alert(t.booking.errorCancelThis);
    } finally {
      setBusy(false);
    }
  }

  function openReschedule() {
    setRescheduleError(null);
    setRescheduling(true);
  }

  const dialogs = (
    <>
      <Dialog
        open={rescheduling}
        onClose={() => setRescheduling(false)}
        title={t.booking.rescheduleDialogTitle.replace("{name}", b.customer_name)}
      >
        <p className="mb-4 text-sm text-muted-foreground">
          {t.booking.rescheduleDialogSubtitle.replace("{service}", b.service_name).replace("{when}", when)}
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
        onDone={changed}
      />
    </>
  );

  return {
    busy,
    openReschedule,
    openAssign: () => setAssigning(true),
    cancel: () => void cancel(),
    dialogs,
  };
}
