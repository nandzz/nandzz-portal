"use client";

import { Trash2, CalendarOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { StaffMember, WeekdayKey } from "@/lib/types";
import { WEEKDAYS } from "@/lib/widgets/calendar";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();
  const WEEKDAY_LABELS_T: Record<WeekdayKey, string> = {
    mon: t.booking.weekdayMon,
    tue: t.booking.weekdayTue,
    wed: t.booking.weekdayWed,
    thu: t.booking.weekdayThu,
    fri: t.booking.weekdayFri,
    sat: t.booking.weekdaySat,
    sun: t.booking.weekdaySun,
  };
  const workingDays = WEEKDAYS.filter((d) => (staff.availability[d]?.length ?? 0) > 0);
  const daysOff = staff.blackout_dates?.length ?? 0;
  const initial = staff.name?.trim()?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="group relative rounded-2xl border border-border bg-background transition-all hover:border-emerald-400/70 hover:shadow-sm focus-within:border-emerald-400/70">
      <button
        type="button"
        onClick={onOpen}
        aria-label={t.booking.editStaffAria.replace("{name}", staff.name || t.booking.unnamedStaff)}
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
            <p className="truncate font-medium text-foreground">{staff.name || t.booking.unnamedStaff}</p>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {staff.info?.trim() || t.booking.noRoleSet}
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
              ? `${workingDays.length}${workingDays.length === 1 ? t.booking.daySuffix : t.booking.daysSuffix}`
              : t.booking.off}
          </span>
        </div>

        {/* Screen-reader summary of the schedule strip above */}
        <span className="sr-only">
          {workingDays.length > 0
            ? t.booking.worksSr.replace(
                "{days}",
                workingDays.map((d) => WEEKDAY_LABELS_T[d]).join(", ")
              )
            : t.booking.noHoursSetSr}
          {daysOff > 0
            ? ` ${(daysOff === 1 ? t.booking.dayOffSrSingular : t.booking.dayOffSrPlural).replace("{count}", String(daysOff))}`
            : ""}
        </span>

        {daysOff > 0 && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <CalendarOff className="h-3 w-3" />
            {daysOff} {daysOff === 1 ? t.booking.dayOffBadgeSingular : t.booking.dayOffBadgePlural}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label={t.booking.removeStaffAria.replace("{name}", staff.name || t.booking.unnamedStaff)}
        title={t.booking.removeTitle}
        className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-muted-foreground opacity-0 outline-none transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-emerald-400 group-hover:opacity-100 dark:hover:bg-red-950/30"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
