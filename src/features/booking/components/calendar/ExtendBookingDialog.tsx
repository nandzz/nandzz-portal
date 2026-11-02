"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

// Owner "Extend" dialog: a timeline of the lane(s) that would grow — this
// booking, the next bookings of the same staff (or location) and the closing
// time — with a draggable end handle. Drag with mouse or touch, click anywhere
// on the track, use the arrow keys on the handle, or tap a preset. The extra
// time is drawn green while free and red where it would overlap someone, in
// which case confirming is disabled (the server enforces the same rule).
// Mounted only while open, so every open starts from a fresh state.

type Block = { starts_at: string; ends_at: string };
type Lane = {
  staff_id: string | null;
  staff_name: string | null;
  own: Block[];
  others: (Block & { customer_name: string })[];
};
type Timeline = {
  timezone: string;
  starts_at: string;
  ends_at: string;
  max_minutes: number;
  closes_at: string | null;
  lanes: Lane[];
  now: number; // client clock when the timeline loaded (the "now" marker)
};

const STEP_MIN = 5;
const MIN_MS = 60_000;
const PRESETS = [15, 30, 45, 60];
// Visible span after the booking's end: at least 2h, enough to show the next
// booking, at most 4h. The booking itself shows at most its last 90 minutes.
const VIEW_AFTER_MIN = 120;
const VIEW_AFTER_MAX = 240;
const VIEW_BEFORE_MAX = 90;
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

export function ExtendBookingDialog({
  token,
  open,
  onClose,
  onDone,
  customerName,
  serviceName,
  when,
}: {
  token: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  customerName: string;
  serviceName: string;
  when: string;
}) {
  const { t, locale } = useLanguage();
  const [data, setData] = useState<Timeline | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [minutes, setMinutes] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/widgets/bookings/${token}/extend`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d: Omit<Timeline, "now">) => {
        if (!cancelled) setData({ ...d, now: Date.now() });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  const view = useMemo(() => {
    if (!data) return null;
    const start = Date.parse(data.starts_at);
    const end = Date.parse(data.ends_at);
    const next = Math.min(
      ...data.lanes.flatMap((l) => l.others.map((o) => Date.parse(o.starts_at)).filter((s) => s >= end)),
      Infinity
    );
    const afterMin = Number.isFinite(next)
      ? Math.min(VIEW_AFTER_MAX, Math.max(VIEW_AFTER_MIN, (next - end) / MIN_MS + 45))
      : VIEW_AFTER_MIN;
    const from = Math.max(start, end - VIEW_BEFORE_MAX * MIN_MS);
    const to = end + afterMin * MIN_MS;
    return {
      from,
      to,
      end,
      clipped: from > start,
      maxDrag: Math.floor(afterMin / STEP_MIN) * STEP_MIN,
      hasNext: Number.isFinite(next),
    };
  }, [data]);

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: data?.timezone,
        hour: "numeric",
        minute: "2-digit",
      }),
    [locale, data?.timezone]
  );
  const time = useCallback((ms: number) => fmt.format(new Date(ms)), [fmt]);

  if (!open) return null;

  const pct = (ms: number) => (view ? ((ms - view.from) / (view.to - view.from)) * 100 : 0);
  const clampPct = (ms: number) => Math.min(100, Math.max(0, pct(ms)));
  const newEnd = view ? view.end + minutes * MIN_MS : 0;
  const free = data?.max_minutes ?? 0;
  const overlapMin = Math.max(0, minutes - free);
  // The first booking the extension runs into (if any).
  const clash =
    data && view && overlapMin > 0
      ? data.lanes
          .flatMap((l) => l.others)
          .filter((o) => Date.parse(o.starts_at) >= view.end && Date.parse(o.starts_at) < newEnd)
          .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0]
      : undefined;

  // Free minutes after the end on one lane (Infinity when nothing follows), so
  // only the lane that actually runs into someone turns red.
  function laneFree(lane: Lane) {
    if (!view) return Infinity;
    const starts = lane.others.map((o) => Date.parse(o.starts_at)).filter((st) => st >= view.end);
    return starts.length > 0 ? (Math.min(...starts) - view.end) / MIN_MS : Infinity;
  }

  function minutesAt(clientX: number) {
    const el = trackRef.current;
    if (!el || !view) return 0;
    const rect = el.getBoundingClientRect();
    const ms = view.from + ((clientX - rect.left) / rect.width) * (view.to - view.from);
    const raw = Math.round((ms - view.end) / MIN_MS / STEP_MIN) * STEP_MIN;
    return Math.min(view.maxDrag, Math.max(0, raw));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // One pointer at a time: a second finger mid-drag must not jump the handle.
    if (pointerId.current !== null || e.button !== 0 || saving) return;
    pointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setError(null);
    setMinutes(minutesAt(e.clientX));
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== pointerId.current) return;
    setMinutes(minutesAt(e.clientX));
  }
  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerId !== pointerId.current) return;
    pointerId.current = null;
    setDragging(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!view) return;
    const step = e.shiftKey ? 15 : STEP_MIN;
    const set = (m: number) => {
      e.preventDefault();
      setError(null);
      setMinutes(Math.min(view.maxDrag, Math.max(0, m)));
    };
    if (e.key === "ArrowRight" || e.key === "ArrowUp") set(minutes + step);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") set(minutes - step);
    else if (e.key === "Home") set(0);
    else if (e.key === "End") set(free > 0 ? Math.floor(free / STEP_MIN) * STEP_MIN : view.maxDrag);
  }

  async function confirm() {
    if (minutes <= 0 || overlapMin > 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/widgets/bookings/${token}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error === "SLOT_TAKEN" ? t.booking.extendErrorClash : t.booking.extendError);
        return;
      }
      onClose();
      onDone();
    } catch {
      setError(t.booking.extendError);
    } finally {
      setSaving(false);
    }
  }

  // Animate preset/keyboard jumps; follow the pointer 1:1 while dragging.
  const move = dragging ? "none" : `left 200ms ${EASE}, width 200ms ${EASE}`;

  // Half-hour ticks across the visible span.
  const ticks: number[] = [];
  if (view) {
    const half = 30 * MIN_MS;
    for (let tk = Math.ceil(view.from / half) * half; tk <= view.to; tk += half) ticks.push(tk);
  }
  const now = data?.now ?? 0;
  const showLaneNames = (data?.lanes.length ?? 0) > 1 || Boolean(data?.lanes[0]?.staff_name);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidthClass="max-w-xl"
      title={t.booking.extendDialogTitle.replace("{name}", customerName)}
    >
      <p className="mb-5 text-sm text-muted-foreground">
        {t.booking.extendDialogSubtitle.replace("{service}", serviceName).replace("{when}", when)}
      </p>

      {loadError ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{t.booking.extendLoadError}</p>
      ) : !data || !view ? (
        <div className="space-y-2" aria-busy>
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-14 w-full animate-pulse rounded-xl bg-muted" />
        </div>
      ) : (
        <>
          {/* Time axis */}
          <div className="relative mb-1.5 h-4 select-none text-[11px] tabular-nums text-muted-foreground">
            {ticks.map((tk) => {
              const p = pct(tk);
              if (p < 4 || p > 96) return null;
              return (
                <span key={tk} className="absolute -translate-x-1/2" style={{ left: `${p}%` }}>
                  {time(tk)}
                </span>
              );
            })}
          </div>

          {/* Track: press/drag anywhere sets the end */}
          <div
            ref={trackRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={cn(
              "relative touch-none select-none space-y-2 rounded-xl",
              dragging ? "cursor-grabbing" : "cursor-pointer"
            )}
          >
            {data.lanes.map((lane, i) => (
              <div key={lane.staff_id ?? `lane-${i}`}>
                {showLaneNames && (
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{lane.staff_name ?? "—"}</p>
                )}
                <div className="relative h-14 overflow-hidden rounded-xl border border-border bg-muted/40">
                  {ticks.map((tk) => (
                    <span
                      key={tk}
                      className="absolute inset-y-0 w-px bg-border/70"
                      style={{ left: `${pct(tk)}%` }}
                      aria-hidden
                    />
                  ))}

                  {/* This booking */}
                  {lane.own.map((b) => {
                    const l = clampPct(Date.parse(b.starts_at));
                    const r = clampPct(Date.parse(b.ends_at));
                    return (
                      <div
                        key={b.starts_at}
                        className={cn(
                          "absolute inset-y-1.5 flex items-center overflow-hidden rounded-lg bg-emerald-600 px-2.5 text-xs font-medium text-white",
                          view.clipped && l === 0 && "rounded-l-none"
                        )}
                        style={{ left: `${l}%`, width: `${r - l}%` }}
                      >
                        <span className="truncate">{customerName}</span>
                      </div>
                    );
                  })}

                  {/* Other bookings on this lane */}
                  {lane.others.map((o) => {
                    const l = clampPct(Date.parse(o.starts_at));
                    const r = clampPct(Date.parse(o.ends_at));
                    if (r <= l) return null;
                    return (
                      <div
                        key={o.starts_at}
                        className="absolute inset-y-1.5 flex items-center overflow-hidden rounded-lg border border-slate-300 bg-slate-200 px-2.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        style={{ left: `${l}%`, width: `${r - l}%` }}
                      >
                        <span className="truncate">{o.customer_name || "—"}</span>
                      </div>
                    );
                  })}

                  {/* Proposed extra time: green while free, red where it overlaps */}
                  {minutes > 0 && (() => {
                    const laneRoom = Math.min(minutes, laneFree(lane));
                    return (
                    <>
                      <div
                        className="absolute inset-y-1.5 rounded-r-lg bg-emerald-500/25 bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(16_185_129/0.25)_6px_12px)] ring-1 ring-inset ring-emerald-500/60"
                        style={{
                          left: `${pct(view.end)}%`,
                          width: `${pct(view.end + laneRoom * MIN_MS) - pct(view.end)}%`,
                          transition: move,
                        }}
                        aria-hidden
                      />
                      {minutes > laneRoom && (
                        <div
                          className="absolute inset-y-1.5 rounded-lg bg-red-500/30 bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(239_68_68/0.35)_6px_12px)] ring-1 ring-inset ring-red-500"
                          style={{
                            left: `${pct(view.end + laneRoom * MIN_MS)}%`,
                            width: `${pct(newEnd) - pct(view.end + laneRoom * MIN_MS)}%`,
                            transition: move,
                          }}
                          aria-hidden
                        />
                      )}
                    </>
                    );
                  })()}
                </div>
              </div>
            ))}

            {/* Closing time (soft) and now markers, spanning every lane */}
            {data.closes_at && pct(Date.parse(data.closes_at)) > 0 && pct(Date.parse(data.closes_at)) < 100 && (
              <span
                className="pointer-events-none absolute inset-y-0 border-l border-dashed border-amber-500"
                style={{ left: `${pct(Date.parse(data.closes_at))}%` }}
                aria-hidden
              />
            )}
            {pct(now) > 0 && pct(now) < 100 && (
              <span
                className="pointer-events-none absolute inset-y-0 w-0.5 rounded bg-sky-500"
                style={{ left: `${pct(now)}%` }}
                aria-hidden
              />
            )}

            {/* End handle */}
            <div
              role="slider"
              tabIndex={0}
              aria-label={t.booking.extendSliderLabel}
              aria-valuemin={0}
              aria-valuemax={view.maxDrag}
              aria-valuenow={minutes}
              aria-valuetext={`${time(newEnd)} (+${t.booking.durationMin.replace("{min}", String(minutes))})`}
              onKeyDown={onKeyDown}
              className="group absolute inset-y-0 z-10 -ml-3 flex w-6 cursor-grab items-center justify-center outline-none active:cursor-grabbing"
              style={{ left: `${pct(newEnd)}%`, transition: dragging ? "none" : `left 200ms ${EASE}` }}
            >
              <span
                className={cn(
                  "absolute inset-y-0 w-0.5 rounded",
                  overlapMin > 0 ? "bg-red-500" : "bg-emerald-600"
                )}
              />
              <span
                className={cn(
                  "relative h-8 w-3.5 rounded-full border-2 bg-background shadow-sm transition-transform duration-150 group-focus-visible:ring-2 group-focus-visible:ring-emerald-500 group-focus-visible:ring-offset-2",
                  overlapMin > 0 ? "border-red-500" : "border-emerald-600",
                  dragging && "scale-110"
                )}
              />
            </div>
          </div>

          {/* Legend */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {data.closes_at && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 border-l border-dashed border-amber-500" />
                {t.booking.extendCloses.replace("{time}", time(Date.parse(data.closes_at)))}
              </span>
            )}
            {pct(now) > 0 && pct(now) < 100 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-0.5 rounded bg-sky-500" />
                {t.booking.extendNow}
              </span>
            )}
            <span>{t.booking.extendDragHint}</span>
          </div>

          {/* Presets */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {PRESETS.map((m) => {
              const tooMuch = m > free;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={saving || m > view.maxDrag}
                  aria-pressed={minutes === m}
                  onClick={() => {
                    setError(null);
                    setMinutes(m);
                  }}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-sm font-medium tabular-nums transition-[transform,background-color,border-color] duration-150 active:scale-[0.97] disabled:opacity-40",
                    minutes === m
                      ? tooMuch
                        ? "border-red-400 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                        : "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : tooMuch
                        ? "border-border text-muted-foreground line-through decoration-red-400/70"
                        : "border-border hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  )}
                >
                  +{t.booking.durationMin.replace("{min}", String(m))}
                </button>
              );
            })}
          </div>

          {/* Status */}
          <div className="mt-4 min-h-10 text-sm" aria-live="polite">
            {overlapMin > 0 ? (
              <p className="flex items-start gap-2 text-red-700 dark:text-red-300">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {t.booking.extendOverlaps
                  .replace("{name}", clash?.customer_name || "—")
                  .replace("{min}", String(overlapMin))
                  .replace("{time}", clash ? time(Date.parse(clash.starts_at)) : "")}
              </p>
            ) : minutes > 0 ? (
              <p className="flex items-start gap-2 text-emerald-700 dark:text-emerald-300">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                {t.booking.extendEndsAt.replace("{time}", time(newEnd))}
                {view.hasNext && ` · ${t.booking.extendFreeUntil.replace("{time}", time(view.end + free * MIN_MS))}`}
              </p>
            ) : (
              <p className="text-muted-foreground">
                {!view.hasNext
                  ? t.booking.extendNoNext
                  : free < STEP_MIN
                    ? t.booking.extendNoRoom
                    : t.booking.extendFreeUntil.replace("{time}", time(view.end + free * MIN_MS))}
              </p>
            )}
          </div>

          {error && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{t.booking.extendHint}</p>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={saving || minutes <= 0 || overlapMin > 0}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-[transform,background-color,opacity] duration-150 hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {minutes > 0
                ? t.booking.extendTo.replace("{time}", time(newEnd)).replace("{min}", String(minutes))
                : t.booking.extendTitle}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
