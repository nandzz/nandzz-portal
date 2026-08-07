"use client";

import { Loader2, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { CalendarService } from "@/lib/types";
import { getLocationScope, withLocationScope } from "@/lib/widgets/calendar";
import type { CalendarConfigController } from "@/components/widgets/calendar/useCalendarConfig";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  controller: CalendarConfigController;
  // Which location the services list below is scoped to — null/undefined
  // falls back to the legacy top-level config for widgets with none.
  currentLocationId?: string | null;
}

export function ServicesManager({ controller, currentLocationId = null }: Props) {
  const { t } = useLanguage();
  const { config, setConfig, saving, status, save } = controller;
  const scope = getLocationScope(config, currentLocationId);

  // Mutators recompute the scope fresh from the setConfig updater's `c`
  // instead of closing over the outer `scope`, so rapid successive edits
  // never read a stale snapshot (mirrors StaffManager's mutators).
  function addService() {
    const svc: CalendarService = {
      id: `svc_${Math.random().toString(36).slice(2, 9)}`,
      name: t.booking.newServiceDefaultName,
      duration_min: 30,
    };
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, { services: [...s.services, svc] });
    });
  }
  function updateService(id: string, fields: Partial<CalendarService>) {
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, {
        services: s.services.map((sv) => (sv.id === id ? { ...sv, ...fields } : sv)),
      });
    });
  }
  function removeService(id: string) {
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, { services: s.services.filter((sv) => sv.id !== id) });
    });
  }
  // Toggle a staff member in a service's allow-list. Empty ⇒ anyone may perform it.
  function toggleServiceStaff(serviceId: string, staffId: string) {
    const svc = scope.services.find((s) => s.id === serviceId);
    const current = svc?.staff_ids ?? [];
    const next = current.includes(staffId)
      ? current.filter((x) => x !== staffId)
      : [...current, staffId];
    updateService(serviceId, { staff_ids: next });
  }

  const inputCls = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm";

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-background p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{t.booking.servicesSection}</h2>
          <Button variant="outline" size="sm" onClick={addService}>
            <Plus className="h-4 w-4" /> {t.booking.addButton}
          </Button>
        </div>
        <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">{t.booking.showPricesLabel}</p>
            <p className="text-xs text-muted-foreground">{t.booking.showPricesDesc}</p>
          </div>
          <input
            type="checkbox"
            checked={config.show_prices}
            onChange={(e) => setConfig((c) => ({ ...c, show_prices: e.target.checked }))}
            className="h-5 w-5 shrink-0 accent-emerald-600"
          />
        </label>
        {scope.services.length === 0 && (
          <p className="text-sm text-muted-foreground">{t.booking.addServiceHint}</p>
        )}
        <div className="space-y-2">
          {scope.services.map((s) => (
            <div key={s.id} className="rounded-lg border border-border p-2 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={`${inputCls} flex-1 min-w-[8rem]`}
                  value={s.name}
                  onChange={(e) => updateService(s.id, { name: e.target.value })}
                  placeholder={t.booking.servicePlaceholder}
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
                  {t.booking.minSuffix}
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
                  aria-label={t.booking.removeServiceAria}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Which staff can perform this service. Empty ⇒ anyone. */}
              {scope.staff.length > 0 && (
                <div className="space-y-1.5 border-t border-border/50 pt-2">
                  <p className="text-xs text-muted-foreground">
                    {t.booking.whoCanPerform}{" "}
                    <span className="italic">{t.booking.whoCanPerformHint}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {scope.staff.map((st) => {
                      const on = (s.staff_ids ?? []).includes(st.id);
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => toggleServiceStaff(s.id, st.id)}
                          aria-pressed={on}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium transition ${
                            on
                              ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <Avatar size="sm" className="h-5 w-5">
                            <AvatarImage src={st.photo_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {st.name?.[0]?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          {st.name || t.booking.unnamedStaff}
                          {on && <Check className="h-3 w-3" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Save bar — persists the whole shared config via the controller, so
          saving here also commits Availability/Notifications edits and vice versa. */}
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
