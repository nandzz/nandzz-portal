"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarConfig, CalendarService, WeekdayKey } from "@/lib/types";
import { WEEKDAYS, WEEKDAY_LABELS, normalizeCalendarConfig } from "@/lib/widgets/calendar";

interface Props {
  instanceId: string;
  initialConfig: CalendarConfig;
  initialEnabled: boolean;
  hasAccess: boolean;
}

export function CalendarWidgetStudio({ instanceId, initialConfig, initialEnabled, hasAccess }: Props) {
  const [config, setConfig] = useState<CalendarConfig>(normalizeCalendarConfig(initialConfig));
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  function patch(update: Partial<CalendarConfig>) {
    setConfig((c) => ({ ...c, ...update }));
  }

  // ── services ──
  function addService() {
    const svc: CalendarService = {
      id: `svc_${Math.random().toString(36).slice(2, 9)}`,
      name: "New service",
      duration_min: 30,
    };
    patch({ services: [...config.services, svc] });
  }
  function updateService(id: string, fields: Partial<CalendarService>) {
    patch({ services: config.services.map((s) => (s.id === id ? { ...s, ...fields } : s)) });
  }
  function removeService(id: string) {
    patch({ services: config.services.filter((s) => s.id !== id) });
  }

  // ── availability ──
  function addWindow(day: WeekdayKey) {
    const windows = [...(config.availability[day] ?? []), ["09:00", "17:00"] as [string, string]];
    patch({ availability: { ...config.availability, [day]: windows } });
  }
  function updateWindow(day: WeekdayKey, idx: number, which: 0 | 1, value: string) {
    const windows = (config.availability[day] ?? []).map((w, i) =>
      i === idx ? ((which === 0 ? [value, w[1]] : [w[0], value]) as [string, string]) : w
    );
    patch({ availability: { ...config.availability, [day]: windows } });
  }
  function removeWindow(day: WeekdayKey, idx: number) {
    const windows = (config.availability[day] ?? []).filter((_, i) => i !== idx);
    patch({ availability: { ...config.availability, [day]: windows } });
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/widgets/instances/${instanceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, enabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ ok: false, msg: data.error ?? "Could not save." });
        return;
      }
      setStatus({ ok: true, msg: "Saved." });
    } catch {
      setStatus({ ok: false, msg: "Could not save." });
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm";

  return (
    <div className="space-y-8">
      {/* Visibility */}
      <section className="rounded-2xl border border-border bg-background p-5">
        <label className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Show on profile</p>
            <p className="text-sm text-muted-foreground">
              {hasAccess
                ? "When on, visitors can book from your profile."
                : "Requires an active subscription to appear on your profile."}
            </p>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-5 w-5 accent-emerald-600"
          />
        </label>
      </section>

      {/* General */}
      <section className="rounded-2xl border border-border bg-background p-5 space-y-4">
        <h2 className="font-semibold">General</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-muted-foreground">Timezone (IANA)</span>
            <input
              className={`${inputCls} w-full`}
              value={config.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
              placeholder="Europe/Lisbon"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-muted-foreground">Buffer between bookings (min)</span>
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

      {/* Services */}
      <section className="rounded-2xl border border-border bg-background p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Services</h2>
          <Button variant="outline" size="sm" onClick={addService}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        {config.services.length === 0 && (
          <p className="text-sm text-muted-foreground">Add at least one service so visitors can book.</p>
        )}
        <div className="space-y-2">
          {config.services.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
              <input
                className={`${inputCls} flex-1 min-w-[8rem]`}
                value={s.name}
                onChange={(e) => updateService(s.id, { name: e.target.value })}
                placeholder="Service name"
              />
              <label className="flex items-center gap-1 text-sm text-muted-foreground">
                <input
                  type="number"
                  min={5}
                  step={5}
                  className={`${inputCls} w-20`}
                  value={s.duration_min}
                  onChange={(e) => updateService(s.id, { duration_min: Number(e.target.value) })}
                />
                min
              </label>
              <label className="flex items-center gap-1 text-sm text-muted-foreground">
                $
                <input
                  type="number"
                  min={0}
                  step={1}
                  className={`${inputCls} w-24`}
                  value={s.price_cents != null ? (s.price_cents / 100).toString() : ""}
                  onChange={(e) =>
                    updateService(s.id, {
                      price_cents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100),
                    })
                  }
                  placeholder="0"
                />
              </label>
              <button
                onClick={() => removeService(s.id)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-red-600"
                aria-label="Remove service"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Availability */}
      <section className="rounded-2xl border border-border bg-background p-5 space-y-3">
        <h2 className="font-semibold">Weekly availability</h2>
        {WEEKDAYS.map((day) => (
          <div key={day} className="flex flex-wrap items-start gap-3 border-b border-border/50 py-2 last:border-0">
            <span className="w-24 pt-1.5 text-sm font-medium">{WEEKDAY_LABELS[day]}</span>
            <div className="flex flex-1 flex-wrap gap-2">
              {(config.availability[day] ?? []).map((w, idx) => (
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
                    aria-label="Remove window"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addWindow(day)}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-emerald-400 hover:text-foreground"
              >
                <Plus className="h-3 w-3" /> Add hours
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Blackout dates */}
      <section className="rounded-2xl border border-border bg-background p-5 space-y-3">
        <h2 className="font-semibold">Blackout dates</h2>
        <div className="flex flex-wrap gap-2">
          {config.blackout_dates.map((d) => (
            <span key={d} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-sm">
              {d}
              <button
                onClick={() => patch({ blackout_dates: config.blackout_dates.filter((x) => x !== d) })}
                className="text-muted-foreground hover:text-red-600"
                aria-label="Remove date"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <input
          type="date"
          className={inputCls}
          onChange={(e) => {
            const d = e.target.value;
            if (d && !config.blackout_dates.includes(d)) {
              patch({ blackout_dates: [...config.blackout_dates, d].sort() });
            }
          }}
        />
      </section>

      {/* Save bar */}
      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-xl border border-border bg-background/90 p-3 backdrop-blur">
        {status && (
          <span className={`text-sm ${status.ok ? "text-emerald-600" : "text-red-600"}`}>
            {status.ok && <Check className="mr-1 inline h-4 w-4" />}
            {status.msg}
          </span>
        )}
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </div>
  );
}
