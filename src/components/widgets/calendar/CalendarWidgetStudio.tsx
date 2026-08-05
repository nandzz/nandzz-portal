"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, Check, CircleAlert, CreditCard, Eye, SlidersHorizontal, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SubscribeButton } from "@/components/widgets/SubscribeButton";
import type { CalendarConfig, CalendarService, WeekdayKey } from "@/lib/types";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/lib/widgets/calendar";
import { MessageTemplateEditor } from "@/components/widgets/calendar/MessageTemplateEditor";
import type { CalendarConfigController } from "@/components/widgets/calendar/useCalendarConfig";

// Settings sub-sections, shown one at a time via the left sidebar. Staff roster
// CRUD now lives in its own top-level tab (StaffManager); only per-service staff
// assignment remains here, inside Booking setup → Services.
const SECTIONS = [
  { key: "billing", label: "Billing", icon: CreditCard },
  { key: "visibility", label: "Visibility", icon: Eye },
  { key: "booking", label: "Booking setup", icon: SlidersHorizontal },
  { key: "notifications", label: "Notifications", icon: Bell },
] as const;

interface Props {
  catalogId: string;
  hasAccess: boolean;
  controller: CalendarConfigController;
}

export function CalendarWidgetStudio({ catalogId, hasAccess, controller }: Props) {
  const { config, setConfig, enabled, setEnabled, saving, status, save } = controller;

  // Which Settings sub-section is showing. Billing has no save bar; the rest
  // share the single config Save bar below.
  const [section, setSection] = useState("billing");

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
  // Toggle a staff member in a service's allow-list. Empty ⇒ anyone may perform it.
  function toggleServiceStaff(serviceId: string, staffId: string) {
    const svc = config.services.find((s) => s.id === serviceId);
    const current = svc?.staff_ids ?? [];
    const next = current.includes(staffId)
      ? current.filter((x) => x !== staffId)
      : [...current, staffId];
    updateService(serviceId, { staff_ids: next });
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

  const inputCls = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm";

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      {/* Left sidebar sub-menu — the classic settings pattern: a vertical menu
          on desktop, a horizontal scroll row on mobile. Distinct from the main
          "line" tab bar above it, so the two levels don't clash. */}
      <nav className="flex gap-1 overflow-x-auto pb-1 md:w-52 md:shrink-0 md:flex-col md:overflow-visible md:pb-0">
        {SECTIONS.map((s) => {
          const active = section === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition md:w-full ${
                active
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <s.icon className="h-4 w-4" /> {s.label}
            </button>
          );
        })}
      </nav>

      {/* Active pane + save bar */}
      <div className="min-w-0 flex-1 space-y-6">
      {/* ══ Billing ══ */}
      {section === "billing" && (
      <div className="space-y-4">
        <GroupHeader
          title="Billing"
          hint="Your subscription keeps the widget live on your profile."
        />
        <section className="rounded-2xl border border-border bg-background p-5">
          {hasAccess ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <Check className="h-4 w-4" /> Active — your widget is live.
              </span>
              {/* POST → Stripe billing portal (303 redirect). */}
              <form action="/api/stripe/portal" method="post">
                <button className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                  Manage subscription
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-700 dark:text-orange-300">
                <CircleAlert className="h-4 w-4" /> No active subscription — your widget is hidden.
              </span>
              <SubscribeButton catalogId={catalogId} label="Subscribe to activate" />
            </div>
          )}
        </section>
      </div>
      )}

      {/* ══ Visibility ══ */}
      {section === "visibility" && (
      <div className="space-y-4">
        <GroupHeader
          title="Visibility"
          hint="Control whether the widget shows up on your public profile."
        />
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
      </div>
      )}

      {/* ══ Booking setup ══ */}
      {section === "booking" && (
      <div className="space-y-4">
        <GroupHeader
          title="Booking setup"
          hint="Services, hours, and the rules visitors book against."
        />
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
          <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Show prices on the booking page</p>
              <p className="text-xs text-muted-foreground">
                When off, visitors book without seeing service prices.
              </p>
            </div>
            <input
              type="checkbox"
              checked={config.show_prices}
              onChange={(e) => patch({ show_prices: e.target.checked })}
              className="h-5 w-5 accent-emerald-600"
            />
          </label>
          {config.services.length === 0 && (
            <p className="text-sm text-muted-foreground">Add at least one service so visitors can book.</p>
          )}
          <div className="space-y-2">
            {config.services.map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
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

                {/* Which staff can perform this service. Empty ⇒ anyone. */}
                {config.staff.length > 0 && (
                  <div className="space-y-1.5 border-t border-border/50 pt-2">
                    <p className="text-xs text-muted-foreground">
                      Who can perform this?{" "}
                      <span className="italic">No one selected = anyone can perform this service.</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {config.staff.map((st) => {
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
                            {st.name || "Unnamed"}
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
      </div>
      )}

      {/* ══ Notifications ══ */}
      {section === "notifications" && (
      <div className="space-y-4">
        <GroupHeader
          title="Notifications"
          hint="Messages sent to customers automatically around their booking."
        />
        {/* Automated messages */}
        <section className="rounded-2xl border border-border bg-background p-5 space-y-4">
          <div>
            <h2 className="font-semibold">Automated messages</h2>
            <p className="text-sm text-muted-foreground">
              Sent to customers automatically. Personalize with the variable chips, and choose a
              channel — or turn a message off.
            </p>
          </div>
          <MessageTemplateEditor
            title="Booking confirmation"
            description="Sent when a customer books an appointment."
            value={config.messages.confirmation}
            onChange={(t) => patch({ messages: { ...config.messages, confirmation: t } })}
          />
          <MessageTemplateEditor
            title="Cancellation"
            description="Sent when a booking is cancelled (by you or the customer)."
            value={config.messages.cancellation}
            onChange={(t) => patch({ messages: { ...config.messages, cancellation: t } })}
          />
        </section>
      </div>
      )}

      {/* Save bar — saves the whole config regardless of the active sub-section.
          Billing has no save (Stripe portal links only), so it's hidden there. */}
      {section !== "billing" && (
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
      )}
      </div>
    </div>
  );
}

function GroupHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="border-b border-border pb-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
