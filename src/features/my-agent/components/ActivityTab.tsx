"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  Hand,
  Inbox,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  const [resolved, setResolved] = useState<Record<string, "approved" | "rejected">>({});

  const pendingCount = items.filter((i) => i.pending && !resolved[i.id]).length;
  const visible = useMemo(
    () => items.filter((i) => (filter === "pending" ? i.pending && !resolved[i.id] : matches(i, filter))),
    [items, filter, resolved],
  );
  const open = items.find((i) => i.id === openId) ?? null;

  // Placeholder: approving only flips local state until the approval RPC exists.
  const resolve = (id: string, outcome: "approved" | "rejected") => {
    setResolved((r) => ({ ...r, [id]: outcome }));
    setItems((list) =>
      list.map((i) =>
        i.id === id
          ? { ...i, title: outcome === "approved" ? "Approved by you" : "Rejected by you" }
          : i,
      ),
    );
    setOpenId(null);
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
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {state === "approved" ? "Approved" : "Rejected"}
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
                <Button variant="outline" className="h-10 flex-1" onClick={() => resolve(open.id, "rejected")}>
                  Reject
                </Button>
                <Button className="h-10 flex-1" onClick={() => resolve(open.id, "approved")}>
                  Approve
                </Button>
              </div>
            ) : undefined
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
              The customer already said yes in the chat. Approving confirms the booking and sends them a WhatsApp + email
              confirmation.
            </p>
          )}
        </ResponsivePanel>
      )}
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
