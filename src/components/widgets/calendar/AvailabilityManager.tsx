"use client";

import { Loader2, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarConfig, WeekdayKey } from "@/lib/types";
import { WEEKDAYS, getLocationScope, withLocationScope } from "@/lib/widgets/calendar";
import type { CalendarConfigController } from "@/components/widgets/calendar/useCalendarConfig";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  controller: CalendarConfigController;
  // Which location the availability/blackout sections below are scoped to —
  // null/undefined falls back to the legacy top-level config for widgets
  // with none (see getLocationScope/withLocationScope).
  currentLocationId?: string | null;
}

export function AvailabilityManager({ controller, currentLocationId = null }: Props) {
  const { t } = useLanguage();
  const { config, setConfig, saving, status, save } = controller;
  const scope = getLocationScope(config, currentLocationId);

  const WEEKDAY_LABELS_T: Record<WeekdayKey, string> = {
    mon: t.booking.weekdayMon,
    tue: t.booking.weekdayTue,
    wed: t.booking.weekdayWed,
    thu: t.booking.weekdayThu,
    fri: t.booking.weekdayFri,
    sat: t.booking.weekdaySat,
    sun: t.booking.weekdaySun,
  };

  function patch(update: Partial<CalendarConfig>) {
    setConfig((c) => ({ ...c, ...update }));
  }

  // Mutators recompute the scope fresh from the setConfig updater's `c`
  // instead of closing over the outer `scope`, so rapid successive edits
  // never read a stale snapshot (mirrors StaffManager's mutators).
  function addWindow(day: WeekdayKey) {
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      const windows = [...(s.availability[day] ?? []), ["09:00", "17:00"] as [string, string]];
      return withLocationScope(c, currentLocationId, { availability: { ...s.availability, [day]: windows } });
    });
  }
  function updateWindow(day: WeekdayKey, idx: number, which: 0 | 1, value: string) {
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      const windows = (s.availability[day] ?? []).map((w, i) =>
        i === idx ? ((which === 0 ? [value, w[1]] : [w[0], value]) as [string, string]) : w
      );
      return withLocationScope(c, currentLocationId, { availability: { ...s.availability, [day]: windows } });
    });
  }
  function removeWindow(day: WeekdayKey, idx: number) {
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      const windows = (s.availability[day] ?? []).filter((_, i) => i !== idx);
      return withLocationScope(c, currentLocationId, { availability: { ...s.availability, [day]: windows } });
    });
  }
  function addBlackoutDate(date: string) {
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      if (s.blackout_dates.includes(date)) return c;
      return withLocationScope(c, currentLocationId, { blackout_dates: [...s.blackout_dates, date].sort() });
    });
  }
  function removeBlackoutDate(date: string) {
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, {
        blackout_dates: s.blackout_dates.filter((x) => x !== date),
      });
    });
  }

  const inputCls = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm";

  return (
    <div className="space-y-4">
      {/* General */}
      <section className="rounded-2xl border border-border bg-background p-5 space-y-4">
        <h2 className="font-semibold">{t.booking.generalSection}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-muted-foreground">{t.booking.timezoneLabel}</span>
            <input
              className={`${inputCls} w-full`}
              value={config.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
              placeholder="Europe/Lisbon"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-muted-foreground">{t.booking.bufferLabel}</span>
            <input
              type="number"
              min={0}
              className={`${inputCls} w-full`}
              value={config.buffer_min}
              onChange={(e) => patch({ buffer_min: Math.max(0, Number(e.target.value)) })}
            />
          </label>
        </div>
      </section>

      {/* Weekly availability */}
      <section className="rounded-2xl border border-border bg-background p-5 space-y-3">
        <h2 className="font-semibold">{t.booking.weeklyAvailability}</h2>
        {WEEKDAYS.map((day) => (
          <div key={day} className="flex flex-col gap-2 border-b border-border/50 py-2 last:border-0 sm:flex-row sm:flex-wrap sm:items-start sm:gap-3">
            <span className="text-sm font-medium sm:w-24 sm:pt-1.5">{WEEKDAY_LABELS_T[day]}</span>
            <div className="flex flex-1 flex-wrap gap-2">
              {(scope.availability[day] ?? []).map((w, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <input
                    type="time"
                    className={inputCls}
                    value={w[0]}
                    onChange={(e) => updateWindow(day, idx, 0, e.target.value)}
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="time"
                    className={inputCls}
                    value={w[1]}
                    onChange={(e) => updateWindow(day, idx, 1, e.target.value)}
                  />
                  <button
                    onClick={() => removeWindow(day, idx)}
                    className="rounded p-1 text-muted-foreground hover:text-red-600"
                    aria-label={t.booking.removeWindowAriaShort}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addWindow(day)}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-emerald-400 hover:text-foreground"
              >
                <Plus className="h-3 w-3" /> {t.booking.addHours}
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Blackout dates */}
      <section className="rounded-2xl border border-border bg-background p-5 space-y-3">
        <h2 className="font-semibold">{t.booking.blackoutDatesSection}</h2>
        <div className="flex flex-wrap gap-2">
          {scope.blackout_dates.map((d) => (
            <span key={d} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-sm">
              {d}
              <button
                onClick={() => removeBlackoutDate(d)}
                className="text-muted-foreground hover:text-red-600"
                aria-label={t.booking.removeDateAria}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <input
          type="date"
          className={`${inputCls} w-full sm:w-auto`}
          onChange={(e) => {
            const d = e.target.value;
            if (d) addBlackoutDate(d);
          }}
        />
      </section>

      {/* Save bar — persists the whole shared config via the controller, so
          saving here also commits Services/Notifications edits and vice versa. */}
      <div className="sticky bottom-4 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-border bg-background/90 p-3 backdrop-blur">
        {status && (
          <span className={`text-sm ${status.ok ? "text-emerald-600" : "text-red-600"}`}>
            {status.ok && <Check className="mr-1 inline h-4 w-4" />}
            {status.msg}
          </span>
        )}
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t.booking.saveChanges}
        </Button>
      </div>
    </div>
  );
}
