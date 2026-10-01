"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";

// One staff member's standing for a given service window, as returned by
// /staff-options: the full roster, each with why they can (or can't) take it.
type StaffOption = {
  id: string;
  name: string;
  photo_url: string | null;
  info: string | null;
  eligible: boolean;
  working: boolean;
  assignable: boolean; // no time clash — the only hard block
  is_current: boolean;
  busy_with: { customer_name: string; service_name: string; starts_at: string; ends_at: string } | null;
};

type ServiceOptions = {
  service_id: string;
  name: string;
  current_staff_id: string | null;
  options: StaffOption[];
};

// Owner's "Assign staff" dialog. Unlike a plain <select>, it shows the WHOLE
// team per service and, for anyone who can't take the slot, the reason — busy
// (with which booking), off-hours, or not usually assigned. Flexibility first:
// the owner can override eligibility/hours; only a real time clash is blocked.
// The Dialog stays mounted; the fetching body mounts only while `open` (keyed on
// token) so each open starts fresh — no synchronous setState in an effect.
export function AssignStaffDialog({
  token,
  timezone,
  open,
  onClose,
  onDone,
}: {
  token: string;
  timezone: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Dialog open={open} onClose={onClose} title={t.booking.assignStaff}>
      {open && <AssignStaffBody token={token} timezone={timezone} onDone={onDone} />}
    </Dialog>
  );
}

// Fetch the staff options for `token` on mount (fresh per open) and render the
// per-service roster.
function AssignStaffBody({
  token,
  timezone,
  onDone,
}: {
  token: string;
  timezone: string;
  onDone: () => void;
}) {
  const { t, locale } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [services, setServices] = useState<ServiceOptions[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null); // `${serviceId}:${staffId}`
  const [error, setError] = useState<string | null>(null);

  // Fetch the current roster; returns null on failure. Shared by mount + reload.
  async function fetchOptions(): Promise<ServiceOptions[] | null> {
    try {
      const res = await fetch(`/api/widgets/bookings/${token}/staff-options`);
      const data = await res.json();
      if (!res.ok) return null;
      return (data.services ?? []) as ServiceOptions[];
    } catch {
      return null;
    }
  }

  // Initial load — state is set only in the async continuation, never
  // synchronously in the effect body.
  useEffect(() => {
    let active = true;
    fetchOptions()
      .then((s) => {
        if (!active) return;
        if (s === null) setLoadError(true);
        else setServices(s);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(
      new Date(iso)
    );

  async function assign(serviceId: string, staffId: string) {
    setSavingId(`${serviceId}:${staffId}`);
    setError(null);
    try {
      const res = await fetch(`/api/widgets/bookings/${token}/staff`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_id: serviceId, staff_id: staffId }),
      });
      if (!res.ok) {
        setError(t.booking.errorAssignStaff);
        return;
      }
      // Reflect the change (and any freed/taken slots) then notify the parent so
      // the row + dashboard refresh.
      const s = await fetchOptions();
      if (s) setServices(s);
      onDone();
    } catch {
      setError(t.booking.errorAssignStaff);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
        <p className="text-xs text-muted-foreground">{t.booking.assignStaffHint}</p>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : loadError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {t.booking.assignStaffLoadError}
          </p>
        ) : (
          services.map((svc) => (
            <div key={svc.service_id} className="space-y-1.5">
              <p className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {svc.name}
              </p>
              <div className="space-y-1.5">
                {svc.options.map((o) => {
                  const saving = savingId === `${svc.service_id}:${o.id}`;
                  // Busy (time clash) is the only thing that disables a row.
                  const disabled = !o.assignable || saving || o.is_current;
                  // Sub-reason line: prefer the hard busy reason; otherwise flag
                  // the soft overrides the owner is accepting.
                  const reason = o.busy_with
                    ? t.booking.staffBusyWith
                        .replace("{name}", o.busy_with.customer_name || o.busy_with.service_name)
                        .replace("{time}", fmtTime(o.busy_with.starts_at))
                    : !o.eligible
                    ? t.booking.staffNotEligible
                    : !o.working
                    ? t.booking.staffOffHours
                    : null;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      disabled={disabled}
                      aria-current={o.is_current}
                      onClick={() => assign(svc.service_id, o.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                        o.is_current
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                          : o.assignable
                          ? "border-border bg-background hover:border-emerald-400 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20"
                          : "border-border bg-muted/40 opacity-70"
                      }`}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={o.photo_url || undefined} alt={o.name} />
                        <AvatarFallback>{o.name.charAt(0).toUpperCase() || "?"}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{o.name}</span>
                        {reason && (
                          <span
                            className={`mt-0.5 flex items-center gap-1 text-xs ${
                              o.busy_with
                                ? "text-red-600 dark:text-red-400"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span className="truncate">{reason}</span>
                          </span>
                        )}
                      </span>
                      <span className="shrink-0">
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : o.is_current ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            <Check className="h-3 w-3" /> {t.booking.staffCurrent}
                          </span>
                        ) : o.assignable ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                            {t.booking.staffAvailableLabel}
                          </span>
                        ) : null}
                      </span>
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
