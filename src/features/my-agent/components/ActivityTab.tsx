"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  Hand,
  Inbox,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { deleteActivityItem } from "../actions/agent-data";
import { decideApproval } from "../actions/decide-approval";
import type { ActivityItem, ActivityKind } from "../types";
import { EmptyState, ResponsivePanel, Segmented, relativeTime } from "./shared";

type Filter = "all" | "pending" | "bookings" | "handoffs" | "errors";

const KIND_META: Record<ActivityKind, { icon: LucideIcon; tone: string }> = {
  approval: { icon: CalendarClock, tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  booking_created: { icon: CalendarCheck, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  rescheduled: { icon: CalendarClock, tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  cancelled: { icon: CalendarX, tone: "bg-muted text-muted-foreground" },
  handoff: { icon: Hand, tone: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  rule: { icon: Sparkles, tone: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  error: { icon: AlertTriangle, tone: "bg-destructive/10 text-destructive" },
};

function matches(item: ActivityItem, filter: Filter) {
  switch (filter) {
    case "pending":
      return !!item.pending;
    case "bookings":
      return ["booking_created", "rescheduled", "cancelled", "approval"].includes(item.kind);
    case "handoffs":
      return item.kind === "handoff";
    case "errors":
      return item.kind === "error";
    default:
      return true;
  }
}

export function ActivityTab({ items: initial, now }: { items: ActivityItem[]; now: number }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Record<string, "approved" | "rejected" | "failed">>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  const pendingCount = items.filter((i) => i.pending && !resolved[i.id]).length;
  const visible = useMemo(
    () => items.filter((i) => (filter === "pending" ? i.pending && !resolved[i.id] : matches(i, filter))),
    [items, filter, resolved],
  );
  const open = items.find((i) => i.id === openId) ?? null;

  // Approving re-checks the slot on the server; it can still end as failed
  // (time taken meanwhile). Either way the agent tells the customer.
  const resolve = (id: string, decision: "approve" | "reject") => {
    setError(null);
    startTransition(async () => {
      const res = await decideApproval({ approvalId: id, decision });
      if (!res.ok) {
        setError(
          res.error === "NOT_PENDING" ? "This request was already decided." : "Something went wrong. Please try again.",
        );
        if (res.error === "NOT_PENDING") router.refresh();
        return;
      }
      const title =
        res.status === "approved"
          ? "Approved by you"
          : res.status === "rejected"
            ? "Rejected by you"
            : "Approved, but the time was no longer free";
      setResolved((r) => ({ ...r, [id]: res.status }));
      setItems((list) => list.map((i) => (i.id === id ? { ...i, title } : i)));
      setOpenId(null);
      router.refresh();
    });
  };

  // Feed entries only; a pending request is approved or rejected instead.
  const remove = async (id: string) => {
    setError(null);
    const res = await deleteActivityItem(id);
    if (!res.ok && res.error !== "NOT_FOUND") {
      setError("Couldn't delete this entry. Please try again.");
      return;
    }
    setItems((list) => list.filter((i) => i.id !== id));
    setOpenId(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <Segmented
        ariaLabel="Filter activity"
        value={filter}
        onChange={setFilter}
        size="sm"
        options={[
          { value: "all", label: "All" },
          { value: "pending", label: "Needs approval", count: pendingCount },
          { value: "bookings", label: "Bookings" },
          { value: "handoffs", label: "Handoffs" },
          { value: "errors", label: "Errors" },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={filter === "pending" ? CheckCircle2 : Inbox}
          title={filter === "pending" ? "You're all caught up" : "Nothing here yet"}
          body={
            filter === "pending"
              ? "Bookings the agent sets as pending show up here for you to approve."
              : "Everything the agent does on WhatsApp appears in this feed."
          }
        />
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
          {visible.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            const state = resolved[item.id];
            const actionable = !!item.pending && !state;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(item.id)}
                  className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                >
                  <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.tone)}>
                    <Icon aria-hidden className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium">{item.title}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{relativeTime(item.at, now)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {item.customer} · {item.detail}
                    </span>
                    {actionable && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        Review
                      </span>
                    )}
                    {state && (
                      <span
                        className={cn(
                          "mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          state === "approved"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : state === "failed"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {state === "approved" ? "Approved" : state === "failed" ? "Not possible" : "Rejected"}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <ResponsivePanel
          open
          onClose={() => setOpenId(null)}
          title={open.title}
          footer={
            open.pending && !resolved[open.id] ? (
              <div className="flex gap-2">
                <Button variant="outline" className="h-10 flex-1" disabled={busy} onClick={() => resolve(open.id, "reject")}>
                  Reject
                </Button>
                <Button className="h-10 flex-1" disabled={busy} onClick={() => resolve(open.id, "approve")}>
                  {busy ? "Working…" : "Approve"}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="h-10 w-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 aria-hidden /> Delete from activity
              </Button>
            )
          }
        >
          <dl className="space-y-3 text-sm">
            <Row label="Customer" value={`${open.customer} · ${open.phone}`} />
            {open.pending ? (
              <>
                <Row label="Service" value={open.pending.service} />
                <Row label="When" value={open.pending.when} />
                <Row label="Staff" value={open.pending.staff} />
              </>
            ) : (
              <Row label="Details" value={open.detail} />
            )}
            {open.reason && <Row label="Why" value={open.reason} />}
            <Row label="When it happened" value={relativeTime(open.at, now)} />
          </dl>
          {open.pending && !resolved[open.id] && (
            <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              The customer already said yes in the chat. Approving checks the time is still free, then confirms it; the
              agent tells the customer on WhatsApp either way.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </ResponsivePanel>
      )}

      <ConfirmDialog
        open={confirmDelete && !!open}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => (open ? remove(open.id) : undefined)}
        title="Delete this entry?"
        description="It disappears from the activity feed. Bookings and the WhatsApp chat are not affected."
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}
