"use client";

import { ArrowLeft, Camera, Loader2, Plus, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { StaffMember, WeekdayKey } from "@/lib/types";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/lib/widgets/calendar";

const inputCls = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-emerald-400";

interface Props {
  staff: StaffMember;
  uploading: boolean;
  onBack: () => void;
  onOpenPhotoPicker: (staffId: string) => void;
  onUpdate: (id: string, fields: Partial<StaffMember>) => void;
  onRemove: (id: string) => void;
  onAddWindow: (staffId: string, day: WeekdayKey) => void;
  onUpdateWindow: (staffId: string, day: WeekdayKey, idx: number, which: 0 | 1, value: string) => void;
  onRemoveWindow: (staffId: string, day: WeekdayKey, idx: number) => void;
  onAddDayOff: (staffId: string, date: string) => void;
  onRemoveDayOff: (staffId: string, date: string) => void;
}

// Detail view: the full single-member editor (photo, name, bio, weekly hours,
// days off, delete). Consumes the CRUD helpers owned by StaffManager so the
// data model and save path stay untouched.
export function StaffEditor({
  staff,
  uploading,
  onBack,
  onOpenPhotoPicker,
  onUpdate,
  onRemove,
  onAddWindow,
  onUpdateWindow,
  onRemoveWindow,
  onAddDayOff,
  onRemoveDayOff,
}: Props) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <ArrowLeft className="h-4 w-4" /> Back to team
      </button>

      <section className="rounded-2xl border border-border bg-background p-5 space-y-6">
        {/* Identity: photo + name + bio */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <button
            type="button"
            onClick={() => onOpenPhotoPicker(staff.id)}
            disabled={uploading}
            aria-label={`Change ${staff.name || "staff"} photo`}
            className="group relative mx-auto shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:mx-0"
          >
            <Avatar size="lg" className="h-20 w-20">
              <AvatarImage src={staff.photo_url || undefined} />
              <AvatarFallback className="bg-emerald-100 text-2xl font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {staff.name?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            </span>
          </button>

          <div className="flex flex-1 flex-col gap-3">
            <div className="space-y-1">
              <label htmlFor={`staff-name-${staff.id}`} className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <input
                id={`staff-name-${staff.id}`}
                className={`${inputCls} w-full text-base font-medium`}
                value={staff.name}
                onChange={(e) => onUpdate(staff.id, { name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`staff-info-${staff.id}`} className="text-xs font-medium text-muted-foreground">
                Role / bio
              </label>
              <textarea
                id={`staff-info-${staff.id}`}
                className={`${inputCls} w-full resize-y`}
                rows={2}
                value={staff.info ?? ""}
                onChange={(e) => onUpdate(staff.id, { info: e.target.value })}
                placeholder="Short role or bio (e.g. Senior stylist) — shown to visitors when they pick a provider."
              />
            </div>
          </div>
        </div>

        {/* Weekly availability */}
        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
          <h3 className="text-sm font-medium">Weekly availability</h3>
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="flex flex-wrap items-start gap-3 border-b border-border/50 py-2 last:border-0"
            >
              <span className="w-24 pt-1.5 text-sm font-medium">{WEEKDAY_LABELS[day]}</span>
              <div className="flex flex-1 flex-wrap gap-2">
                {(staff.availability[day] ?? []).map((w, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <input
                      type="time"
                      className={inputCls}
                      value={w[0]}
                      onChange={(e) => onUpdateWindow(staff.id, day, idx, 0, e.target.value)}
                    />
                    <span className="text-muted-foreground">–</span>
                    <input
                      type="time"
                      className={inputCls}
                      value={w[1]}
                      onChange={(e) => onUpdateWindow(staff.id, day, idx, 1, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveWindow(staff.id, day, idx)}
                      className="rounded p-1 text-muted-foreground transition hover:text-red-600"
                      aria-label={`Remove ${WEEKDAY_LABELS[day]} window`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onAddWindow(staff.id, day)}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1 text-xs text-muted-foreground transition hover:border-emerald-400 hover:text-foreground"
                >
                  <Plus className="h-3 w-3" /> Add hours
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Days off */}
        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
          <h3 className="text-sm font-medium">Days off</h3>
          {(staff.blackout_dates?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {(staff.blackout_dates ?? []).map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-sm"
                >
                  {d}
                  <button
                    type="button"
                    onClick={() => onRemoveDayOff(staff.id, d)}
                    className="text-muted-foreground transition hover:text-red-600"
                    aria-label={`Remove day off ${d}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="Add a day off"
              className={inputCls}
              onChange={(e) => {
                const d = e.target.value;
                if (d && !(staff.blackout_dates ?? []).includes(d)) onAddDayOff(staff.id, d);
              }}
            />
            <span className="text-xs text-muted-foreground">Pick a date to block it off.</span>
          </div>
        </div>

        {/* Danger zone */}
        <div className="flex justify-end border-t border-border pt-4">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onRemove(staff.id)}
          >
            <Trash2 className="h-4 w-4" /> Delete staff member
          </Button>
        </div>
      </section>
    </div>
  );
}
