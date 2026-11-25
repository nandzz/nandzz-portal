"use client";

import { useMemo } from "react";
import { Plus, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { AvailabilityWindows, WeekdayKey } from "@/lib/types";
import { useOrdersT } from "./shared";

const DAYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const MAX_RANGES = 6;

// Compact weekly hours: one row per weekday (open switch + time ranges). Seven
// fixed rows, so it never grows with data. `null` = "any time, every day".
export function WeeklyHoursEditor({
  value,
  onChange,
  disabled,
}: {
  value: AvailabilityWindows | null;
  onChange: (next: AvailabilityWindows) => void;
  disabled?: boolean;
}) {
  const { t, locale } = useOrdersT();
  const hours = value ?? {};
  const names = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    // 2023-01-02 was a Monday.
    return Object.fromEntries(DAYS.map((d, i) => [d, fmt.format(new Date(Date.UTC(2023, 0, 2 + i)))])) as Record<WeekdayKey, string>;
  }, [locale]);

  const set = (day: WeekdayKey, ranges: [string, string][]) => {
    const next = { ...hours, [day]: ranges };
    if (ranges.length === 0) delete next[day];
    onChange(next);
  };

  return (
    <div className="divide-y divide-border/60 rounded-lg border border-border/60">
      {DAYS.map((day) => {
        const ranges = hours[day] ?? [];
        const open = ranges.length > 0;
        return (
          <div key={day} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
            <div className="flex w-24 shrink-0 items-center gap-2">
              <Switch
                checked={open}
                disabled={disabled}
                onCheckedChange={(on) => set(day, on ? [["09:00", "18:00"]] : [])}
                aria-label={names[day]}
              />
              <span className={cn("text-sm capitalize", !open && "text-muted-foreground")}>{names[day]}</span>
            </div>
            {open ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {ranges.map(([a, b], i) => (
                  <div key={i} className="flex items-center gap-1">
                    <TimeInput
                      value={a}
                      disabled={disabled}
                      label={t.hoursFrom}
                      onChange={(v) => set(day, ranges.map((r, j) => (j === i ? [v, r[1]] : r)))}
                    />
                    <span className="text-muted-foreground">–</span>
                    <TimeInput
                      value={b}
                      disabled={disabled}
                      label={t.hoursTo}
                      invalid={a >= b}
                      onChange={(v) => set(day, ranges.map((r, j) => (j === i ? [r[0], v] : r)))}
                    />
                    {ranges.length > 1 && (
                      <IconButton label={t.removeRange} disabled={disabled} onClick={() => set(day, ranges.filter((_, j) => j !== i))}>
                        <X className="h-3.5 w-3.5" />
                      </IconButton>
                    )}
                  </div>
                ))}
                {ranges.length < MAX_RANGES && (
                  <IconButton
                    label={t.addRange}
                    disabled={disabled}
                    onClick={() => set(day, [...ranges, [ranges[ranges.length - 1][1] < "23:00" ? ranges[ranges.length - 1][1] : "09:00", "23:59"]])}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </IconButton>
                )}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">{t.closed}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Weekly hours are valid when every range starts before it ends. */
export function hoursValid(h: AvailabilityWindows | null): boolean {
  return !h || Object.values(h).every((ranges) => (ranges ?? []).every(([a, b]) => a < b));
}

function TimeInput({
  value,
  onChange,
  label,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <input
      type="time"
      value={value}
      disabled={disabled}
      aria-label={label}
      aria-invalid={invalid}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className={cn(
        "h-8 rounded-md border border-input bg-background px-2 text-base tabular-nums md:text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        invalid && "border-destructive",
      )}
    />
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-[background-color,color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.94] focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
