"use client";

import { Trash2, CalendarOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { StaffMember, WeekdayKey } from "@/lib/types";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/lib/widgets/calendar";

// One-letter weekday initials (M T W T F S S) for the at-a-glance schedule strip.
const DAY_INITIALS: Record<WeekdayKey, string> = {
  mon: "M",
  tue: "T",
  wed: "W",
  thu: "T",
  fri: "F",
  sat: "S",
  sun: "S",
};

interface Props {
  staff: StaffMember;
  onOpen: () => void;
  onDelete: () => void;
}

// A compact roster tile: avatar + name + role, with an at-a-glance weekly-schedule
// strip. The whole card opens the editor; the delete affordance is a sibling
// button (not nested) so the markup stays valid and keyboard-navigable.
export function StaffCard({ staff, onOpen, onDelete }: Props) {
  const workingDays = WEEKDAYS.filter((d) => (staff.availability[d]?.length ?? 0) > 0);
  const daysOff = staff.blackout_dates?.length ?? 0;
  const initial = staff.name?.trim()?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="group relative rounded-2xl border border-border bg-background transition-all hover:border-emerald-400/70 hover:shadow-sm focus-within:border-emerald-400/70">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Edit ${staff.name || "staff member"}`}
        className="flex w-full flex-col gap-4 rounded-2xl p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <div className="flex items-start gap-3">
          <Avatar size="lg" className="h-12 w-12 shrink-0">
            <AvatarImage src={staff.photo_url || undefined} />
            <AvatarFallback className="bg-emerald-100 text-base font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 pr-6">
            <p className="truncate font-medium text-foreground">{staff.name || "Unnamed"}</p>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {staff.info?.trim() || "No role set"}
            </p>
          </div>
        </div>

        {/* At-a-glance weekly schedule */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1" aria-hidden>
            {WEEKDAYS.map((d) => {
              const on = (staff.availability[d]?.length ?? 0) > 0;
              return (
                <span
                  key={d}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold transition-colors",
                    on
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground/60"
                  )}
                >
                  {DAY_INITIALS[d]}
                </span>
              );
            })}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {workingDays.length > 0
              ? `${workingDays.length}${workingDays.length === 1 ? " day" : " days"}/wk`
              : "Off"}
          </span>
        </div>

        {/* Screen-reader summary of the schedule strip above */}
        <span className="sr-only">
          {workingDays.length > 0
            ? `Works ${workingDays.map((d) => WEEKDAY_LABELS[d]).join(", ")}.`
            : "No weekly hours set."}
          {daysOff > 0 ? ` ${daysOff} day${daysOff === 1 ? "" : "s"} off.` : ""}
        </span>

        {daysOff > 0 && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <CalendarOff className="h-3 w-3" />
            {daysOff} {daysOff === 1 ? "day off" : "days off"}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Remove ${staff.name || "staff member"}`}
        title="Remove"
        className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-muted-foreground opacity-0 outline-none transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-emerald-400 group-hover:opacity-100 dark:hover:bg-red-950/30"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
