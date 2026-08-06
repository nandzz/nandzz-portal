"use client";

import { ArrowLeft, Camera, Loader2, Plus, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Location, WeekdayKey } from "@/lib/types";
import { WEEKDAYS } from "@/lib/widgets/calendar";
import { useLanguage } from "@/contexts/LanguageContext";

const inputCls = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-emerald-400";

interface Props {
  location: Location;
  uploading: boolean;
  onBack: () => void;
  onOpenPhotoPicker: (locationId: string) => void;
  onUpdate: (id: string, fields: Partial<Location>) => void;
  onRemove: (id: string) => void;
  onAddWindow: (locationId: string, day: WeekdayKey) => void;
  onUpdateWindow: (locationId: string, day: WeekdayKey, idx: number, which: 0 | 1, value: string) => void;
  onRemoveWindow: (locationId: string, day: WeekdayKey, idx: number) => void;
  onAddDayOff: (locationId: string, date: string) => void;
  onRemoveDayOff: (locationId: string, date: string) => void;
}

// Detail view: the full single-location editor (photo, name, address,
// timezone, weekly hours, days off, delete). Mirrors StaffEditor — consumes
// the CRUD helpers owned by LocationManager so the data model and save path
// stay untouched. Note: this editor does NOT manage the location's nested
// services/staff — those are edited via the location-scope selector that
// re-targets the existing Services/Staff/Availability sections.
export function LocationEditor({
  location,
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
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <ArrowLeft className="h-4 w-4" /> {t.booking.backToLocations}
      </button>

      <section className="rounded-2xl border border-border bg-background p-5 space-y-6">
        {/* Identity: photo + name + address + timezone */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <button
            type="button"
            onClick={() => onOpenPhotoPicker(location.id)}
            disabled={uploading}
            aria-label={t.booking.changeLocationPhotoAria.replace("{name}", location.name || t.booking.unnamedLocation)}
            className="group relative mx-auto shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:mx-0"
          >
            <Avatar size="lg" className="h-20 w-20">
              <AvatarImage src={location.photo_url || undefined} />
              <AvatarFallback className="bg-emerald-100 text-2xl font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {location.name?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            </span>
          </button>

          <div className="flex flex-1 flex-col gap-3">
            <div className="space-y-1">
              <label htmlFor={`location-name-${location.id}`} className="text-xs font-medium text-muted-foreground">
                {t.booking.nameLabel}
              </label>
              <input
                id={`location-name-${location.id}`}
                className={`${inputCls} w-full text-base font-medium`}
                value={location.name}
                onChange={(e) => onUpdate(location.id, { name: e.target.value })}
                placeholder={t.booking.locationNamePlaceholder}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`location-address-${location.id}`} className="text-xs font-medium text-muted-foreground">
                {t.booking.addressLabel}
              </label>
              <input
                id={`location-address-${location.id}`}
                className={`${inputCls} w-full`}
                value={location.address ?? ""}
                onChange={(e) => onUpdate(location.id, { address: e.target.value })}
                placeholder={t.booking.addressPlaceholder}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`location-tz-${location.id}`} className="text-xs font-medium text-muted-foreground">
                {t.booking.locationTimezoneLabel}
              </label>
              <input
                id={`location-tz-${location.id}`}
                className={`${inputCls} w-full`}
                value={location.timezone ?? ""}
                onChange={(e) => onUpdate(location.id, { timezone: e.target.value || undefined })}
                placeholder="Europe/Lisbon"
              />
              <p className="text-xs text-muted-foreground">{t.booking.locationTimezoneHint}</p>
            </div>
          </div>
        </div>

        {/* Weekly hours */}
        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
          <h3 className="text-sm font-medium">{t.booking.weeklyAvailability}</h3>
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="flex flex-wrap items-start gap-3 border-b border-border/50 py-2 last:border-0"
            >
              <span className="w-24 pt-1.5 text-sm font-medium">{WEEKDAY_LABELS_T[day]}</span>
              <div className="flex flex-1 flex-wrap gap-2">
                {(location.availability[day] ?? []).map((w, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <input
                      type="time"
                      className={inputCls}
                      value={w[0]}
                      onChange={(e) => onUpdateWindow(location.id, day, idx, 0, e.target.value)}
                    />
                    <span className="text-muted-foreground">–</span>
                    <input
                      type="time"
                      className={inputCls}
                      value={w[1]}
                      onChange={(e) => onUpdateWindow(location.id, day, idx, 1, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveWindow(location.id, day, idx)}
                      className="rounded p-1 text-muted-foreground transition hover:text-red-600"
                      aria-label={t.booking.removeWindowAria.replace("{day}", WEEKDAY_LABELS_T[day])}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onAddWindow(location.id, day)}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1 text-xs text-muted-foreground transition hover:border-emerald-400 hover:text-foreground"
                >
                  <Plus className="h-3 w-3" /> {t.booking.addHours}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Days off */}
        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
          <h3 className="text-sm font-medium">{t.booking.daysOff}</h3>
          {(location.blackout_dates?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {(location.blackout_dates ?? []).map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-sm"
                >
                  {d}
                  <button
                    type="button"
                    onClick={() => onRemoveDayOff(location.id, d)}
                    className="text-muted-foreground transition hover:text-red-600"
                    aria-label={t.booking.removeDayOffAria.replace("{date}", d)}
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
              aria-label={t.booking.addDayOffAria}
              className={inputCls}
              onChange={(e) => {
                const d = e.target.value;
                if (d && !(location.blackout_dates ?? []).includes(d)) onAddDayOff(location.id, d);
              }}
            />
            <span className="text-xs text-muted-foreground">{t.booking.pickDateToBlock}</span>
          </div>
        </div>

        {/* Danger zone */}
        <div className="flex justify-end border-t border-border pt-4">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onRemove(location.id)}
          >
            <Trash2 className="h-4 w-4" /> {t.booking.deleteLocation}
          </Button>
        </div>
      </section>
    </div>
  );
}
