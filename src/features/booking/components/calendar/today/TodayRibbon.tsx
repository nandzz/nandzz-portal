"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TodayBooking, TodayData } from "@/features/booking/dashboardTypes";
import { phaseOf, type TodayFormat, type TodayPhase } from "./todayFormat";

// The day at a glance: opening hours as a track (closed time hatched), every
// confirmed appointment as a block on its staff member's lane, and a live
// "now" needle. Blocks are buttons — clicking one focuses that appointment.

const HOUR_MS = 60 * 60_000;

// Same emerald encoding as the dashboard: solid = realized, light = still ahead.
const BLOCK_STYLES: Record<Exclude<TodayPhase, "cancelled">, string> = {
  done: "bg-emerald-600/80 text-white dark:bg-emerald-500/70",
  live: "bg-emerald-600 text-white ring-2 ring-emerald-600/30 dark:bg-emerald-500",
  upcoming: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/70 dark:text-emerald-100",
};

const CLOSED_FILL =
  "repeating-linear-gradient(135deg, var(--border) 0 1px, transparent 1px 7px)";

export function TodayRibbon({
  data,
  now,
  selectedId,
  onSelect,
  fmt,
}: {
  data: TodayData;
  now: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  fmt: TodayFormat;
}) {
  const { t } = useLanguage();
  const tt = t.bookingToday;

  const byId = useMemo(() => new Map(data.bookings.map((b) => [b.id, b])), [data.bookings]);

  // Visible span: opening hours and every block, snapped out to whole hours.
  const range = useMemo(() => {
    const points = [
      ...data.hours.flatMap((h) => [Date.parse(h.start), Date.parse(h.end)]),
      ...data.blocks.flatMap((b) => [Date.parse(b.start), Date.parse(b.end)]),
    ];
    if (points.length === 0) return null;
    const start = Math.floor(Math.min(...points) / HOUR_MS) * HOUR_MS;
    const end = Math.max(start + HOUR_MS, Math.ceil(Math.max(...points) / HOUR_MS) * HOUR_MS);
    return { start, end };
  }, [data.hours, data.blocks]);

  if (!range) return null;

  const span = range.end - range.start;
  const pct = (ms: number) => ((ms - range.start) / span) * 100;
  const hours = Array.from({ length: Math.round(span / HOUR_MS) + 1 }, (_, i) => range.start + i * HOUR_MS);
  const dense = hours.length > 11; // label every other hour on long days
  const nowInRange = now >= range.start && now <= range.end;

  const lanes: { id: string | null; name: string }[] =
    data.lanes.length > 0 ? data.lanes.map((l) => ({ id: l.id, name: l.name || tt.unassigned })) : [{ id: null, name: "" }];
  const named = data.lanes.length > 0;
  const blocksFor = (laneId: string | null) =>
    named ? data.blocks.filter((b) => (b.staffId ?? "") === laneId) : data.blocks;

  return (
    <div>
      <div className={cn("grid gap-x-3", named ? "grid-cols-[5.5rem_1fr]" : "grid-cols-1")}>
        {/* Hour scale */}
        {named && <span />}
        <div className="relative mb-1.5 h-4 text-[11px] tabular-nums text-muted-foreground">
          {hours.map((h, i) => (
            <span
              key={h}
              className={cn(
                "absolute -translate-x-1/2",
                i === 0 && "translate-x-0",
                i === hours.length - 1 && "-translate-x-full",
                (dense ? i % 2 === 1 : false) && "hidden",
                !dense && i % 2 === 1 && "hidden sm:inline",
              )}
              style={{ left: `${pct(h)}%` }}
            >
              {fmt.time(h)}
            </span>
          ))}
        </div>

        {lanes.map((lane) => (
          <Lane
            key={lane.id ?? "all"}
            name={named ? lane.name : null}
            blocks={blocksFor(lane.id)}
            hours={data.hours}
            pct={pct}
            byId={byId}
            now={now}
            selectedId={selectedId}
            onSelect={onSelect}
            fmt={fmt}
            nowPct={nowInRange ? pct(now) : null}
            nowLabel={tt.now}
            isFirst={lane === lanes[0]}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <LegendSwatch className="bg-emerald-600/80 dark:bg-emerald-500/70" label={tt.legendDone} />
        <LegendSwatch className="bg-emerald-200 dark:bg-emerald-900/70" label={tt.legendUpcoming} />
        <LegendSwatch className="bg-muted" label={tt.legendFree} />
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-border" style={{ background: CLOSED_FILL }} />
          {tt.legendClosed}
        </span>
        {nowInRange && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-0.5 rounded-full bg-rose-500" />
            {tt.now} {fmt.time(now)}
          </span>
        )}
      </div>
    </div>
  );
}

function Lane({
  name,
  blocks,
  hours,
  pct,
  byId,
  now,
  selectedId,
  onSelect,
  fmt,
  nowPct,
  nowLabel,
  isFirst,
}: {
  name: string | null;
  blocks: TodayData["blocks"];
  hours: TodayData["hours"];
  pct: (ms: number) => number;
  byId: Map<string, TodayBooking>;
  now: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  fmt: TodayFormat;
  nowPct: number | null;
  nowLabel: string;
  isFirst: boolean;
}) {
  return (
    <>
      {name !== null && (
        <span className="flex h-8 items-center truncate text-xs text-muted-foreground" title={name}>
          {name}
        </span>
      )}
      <div
        className="relative mb-1.5 h-8 overflow-visible rounded-md border border-border/60"
        style={{ background: CLOSED_FILL }}
      >
        {hours.map((h) => (
          <span
            key={h.start}
            className="absolute inset-y-0 bg-muted"
            style={{ left: `${pct(Date.parse(h.start))}%`, width: `${pct(Date.parse(h.end)) - pct(Date.parse(h.start))}%` }}
          />
        ))}

        {blocks.map((block, i) => {
          const b = byId.get(block.bookingId);
          if (!b) return null;
          const phase = phaseOf({ status: "confirmed", starts_at: block.start, ends_at: block.end }, now);
          const style = BLOCK_STYLES[phase === "cancelled" ? "upcoming" : phase];
          const label = `${fmt.time(block.start)}–${fmt.time(block.end)} ${b.customer_name}`;
          return (
            <button
              key={`${block.bookingId}-${i}`}
              type="button"
              onClick={() => onSelect(b.id)}
              title={label}
              aria-label={label}
              aria-pressed={selectedId === b.id}
              className={cn(
                "absolute inset-y-[3px] overflow-hidden rounded-[5px] px-1.5 text-left text-[11px] font-medium leading-[26px] whitespace-nowrap outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-ring",
                style,
                selectedId === b.id && "ring-2 ring-foreground ring-offset-1 ring-offset-background",
              )}
              style={{
                left: `calc(${pct(Date.parse(block.start))}% + 1px)`,
                width: `calc(${pct(Date.parse(block.end)) - pct(Date.parse(block.start))}% - 2px)`,
              }}
            >
              {b.customer_name.split(" ")[0]}
            </button>
          );
        })}

        {nowPct !== null && (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-y-1 z-10 w-0.5 -translate-x-1/2 rounded-full bg-rose-500"
            style={{ left: `${nowPct}%` }}
          >
            {isFirst && <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-rose-500" />}
            <span className="sr-only">{nowLabel}</span>
          </span>
        )}
      </div>
    </>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-sm", className)} />
      {label}
    </span>
  );
}
