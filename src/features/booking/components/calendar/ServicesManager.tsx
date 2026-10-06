"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus, SlidersHorizontal, Tag, Trash2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { CalendarCategory, CalendarService, WhatsAppReminderHours } from "@/lib/types";
import { WHATSAPP_REMINDER_HOURS } from "@/lib/types";
import { getLocationScope, withLocationScope } from "@/features/booking/domain/calendar";
import { WIDGET_CURRENCIES, currencySymbol } from "@/features/booking/domain/messages";
import type { CalendarConfigController } from "@/features/booking/components/calendar/useCalendarConfig";
import { ServiceCard } from "@/features/booking/components/calendar/ServiceCard";
import { ServiceEditor } from "@/features/booking/components/calendar/ServiceEditor";
import { SaveBar } from "@/features/booking/components/calendar/SaveBar";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  controller: CalendarConfigController;
  // Which location the services list below is scoped to — null/undefined
  // falls back to the legacy top-level config for widgets with none.
  currentLocationId?: string | null;
}

type Mode = "list" | "edit";

// Top-level Services tab: a master–detail catalog that mirrors StaffManager. The
// LIST view is a grid of compact cards; clicking one (or creating) opens the EDIT
// view — the focused single-service editor. Keeping editing out of the list means
// the catalog stays scannable no matter how many services the owner adds. Below the
// list sit the booking-page options (prices, address capture), shown only in list
// mode so they never compete with the editor. Consumes the shared config controller
// so its saves stay in lockstep with the other tabs.
export function ServicesManager({ controller, currentLocationId = null }: Props) {
  const { t } = useLanguage();
  const { config, setConfig, saving, status, save } = controller;
  const scope = getLocationScope(config, currentLocationId);

  // Master–detail navigation (local UI state only — never persisted).
  const [mode, setMode] = useState<Mode>("list");
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  // Which category's services the grid shows: "all", "uncat" (no category), or a
  // category id. Keeps the catalog to one grid tall no matter how many categories
  // exist, instead of stacking a full section per category.
  const [activeFilter, setActiveFilter] = useState<string>("all");
  // The category-management dialog (add/rename/delete) — off the main view so the
  // list stays a clean, scannable grid.
  const [manageOpen, setManageOpen] = useState(false);

  // Mutators recompute the scope fresh from the setConfig updater's `c`
  // instead of closing over the outer `scope`, so rapid successive edits
  // never read a stale snapshot (mirrors StaffManager's mutators).
  // `categoryId` pre-assigns the new service to a category (from a category's
  // "add" affordance); null ⇒ created uncategorized (the top-level button).
  function createService(categoryId: string | null = null) {
    const svc: CalendarService = {
      id: `svc_${Math.random().toString(36).slice(2, 9)}`,
      name: t.booking.newServiceDefaultName,
      duration_min: 30,
      category_id: categoryId,
    };
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, { services: [...s.services, svc] });
    });
    // Jump straight into the editor for the fresh service.
    setEditingServiceId(svc.id);
    setMode("edit");
  }

  // ── categories ── create/rename/delete, mirroring the service mutators. Each
  // recomputes the scope fresh from the updater's `c` so rapid edits never read
  // a stale snapshot.
  function createCategory() {
    const cat: CalendarCategory = {
      id: `cat_${Math.random().toString(36).slice(2, 9)}`,
      name: t.booking.newCategoryDefaultName,
    };
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, { categories: [...s.categories, cat] });
    });
  }
  function renameCategory(id: string, name: string) {
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, {
        categories: s.categories.map((cat) => (cat.id === id ? { ...cat, name } : cat)),
      });
    });
  }
  // Deleting a category also clears it from any service that referenced it, so no
  // service is left pointing at a category that no longer exists.
  function removeCategory(id: string) {
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, {
        categories: s.categories.filter((cat) => cat.id !== id),
        services: s.services.map((sv) =>
          sv.category_id === id ? { ...sv, category_id: null } : sv
        ),
      });
    });
    // Don't leave the grid filtered to a category that no longer exists.
    if (activeFilter === id) setActiveFilter("all");
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
    // Deleting always returns to the catalog.
    if (editingServiceId === id) {
      setEditingServiceId(null);
      setMode("list");
    }
  }
  // Toggle a staff member in a service's allow-list. Empty ⇒ anyone may perform it.
  function toggleServiceStaff(serviceId: string, staffId: string) {
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, {
        services: s.services.map((sv) => {
          if (sv.id !== serviceId) return sv;
          const current = sv.staff_ids ?? [];
          const next = current.includes(staffId)
            ? current.filter((x) => x !== staffId)
            : [...current, staffId];
          return { ...sv, staff_ids: next };
        }),
      });
    });
  }

  // ── navigation ──
  function openEditor(id: string) {
    setEditingServiceId(id);
    setMode("edit");
  }
  function backToList() {
    setMode("list");
    setEditingServiceId(null);
  }

  // Saving from the editor persists the whole config, then returns to the catalog
  // on success (a failed/invalid save keeps you on the service so you can fix it).
  // From the list view it just persists in place.
  async function handleSave() {
    const ok = await save();
    if (ok && mode === "edit") backToList();
  }

  // The service currently open in the detail view (may vanish if deleted elsewhere).
  const editingService = useMemo(
    () => (mode === "edit" ? scope.services.find((s) => s.id === editingServiceId) ?? null : null),
    [mode, editingServiceId, scope.services]
  );

  // Services bucketed by category for the grouped list view: one bucket per
  // category (in the owner's chosen order) plus a trailing "uncategorized" bucket
  // for services with no category (or one whose id no longer resolves).
  const { byCategory, uncategorized } = useMemo(() => {
    const catIds = new Set(scope.categories.map((c) => c.id));
    const byCategory = new Map<string, CalendarService[]>();
    const uncategorized: CalendarService[] = [];
    for (const s of scope.services) {
      if (s.category_id && catIds.has(s.category_id)) {
        const list = byCategory.get(s.category_id) ?? [];
        list.push(s);
        byCategory.set(s.category_id, list);
      } else {
        uncategorized.push(s);
      }
    }
    return { byCategory, uncategorized };
  }, [scope.services, scope.categories]);
  const hasCategories = scope.categories.length > 0;

  // A single service tile — shared by the grouped and flat list layouts below.
  const renderCard = (s: CalendarService) => (
    <ServiceCard
      key={s.id}
      service={s}
      staff={scope.staff}
      currencySymbol={currencySymbol(config.currency)}
      onOpen={() => openEditor(s.id)}
      onDelete={() => removeService(s.id)}
    />
  );
  const gridClass = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3";

  // The services shown under the active filter — the grid is only ever this one
  // bucket tall, never the whole catalog stacked category-by-category.
  const filteredServices =
    activeFilter === "all"
      ? scope.services
      : activeFilter === "uncat"
      ? uncategorized
      : byCategory.get(activeFilter) ?? [];
  // "+ New service" seeds into whichever category is being viewed (null — i.e.
  // "Other services" — for the All / Other filters).
  const newServiceCategory =
    activeFilter === "all" || activeFilter === "uncat" ? null : activeFilter;

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="border-b border-border pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.booking.servicesSection}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.booking.servicesSectionDesc}</p>
      </div>

      {mode === "edit" && editingService ? (
        <ServiceEditor
          service={editingService}
          staff={scope.staff}
          categories={scope.categories}
          currencySymbol={currencySymbol(config.currency)}
          onBack={backToList}
          onUpdate={updateService}
          onRemove={removeService}
          onToggleStaff={toggleServiceStaff}
        />
      ) : scope.services.length === 0 ? (
        // Empty state — no services yet.
        <div className="rounded-2xl border border-dashed border-border bg-background px-5 py-14 text-center">
          <Tag className="mx-auto h-9 w-9 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">{t.booking.noServicesTitle}</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{t.booking.noServicesDesc}</p>
          <Button className="mt-5" onClick={() => createService()}>
            <Plus className="h-4 w-4" /> {t.booking.createFirstService}
          </Button>
        </div>
      ) : (
        // List view — categories manager, then the grouped service grid, then
        // the booking-page options below.
        <div className="space-y-6">
          {/* A filter/manage toolbar, then a single grid scoped to the active
              filter — the catalog stays one grid tall no matter how many
              categories exist, instead of stacking a full section per category. */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">{t.booking.servicesSection}</h3>
                <span className="text-sm text-muted-foreground tabular-nums">{scope.services.length}</span>
              </div>
              <Button className="shrink-0" onClick={() => createService(newServiceCategory)}>
                <Plus className="h-4 w-4" /> {t.booking.newService}
              </Button>
            </div>

            {/* Category filter — the organization lives here. Selecting a pill
                scopes the grid; "Manage" opens the add/rename/delete dialog. */}
            <div className="flex flex-wrap items-center gap-2">
              <FilterPill
                label={t.booking.allFilter}
                count={scope.services.length}
                active={activeFilter === "all"}
                onClick={() => setActiveFilter("all")}
              />
              {scope.categories.map((cat) => (
                <FilterPill
                  key={cat.id}
                  label={cat.name?.trim() || t.booking.categoryNamePlaceholder}
                  count={byCategory.get(cat.id)?.length ?? 0}
                  active={activeFilter === cat.id}
                  onClick={() => setActiveFilter(cat.id)}
                />
              ))}
              {hasCategories && uncategorized.length > 0 && (
                <FilterPill
                  label={t.booking.uncategorized}
                  count={uncategorized.length}
                  active={activeFilter === "uncat"}
                  onClick={() => setActiveFilter("uncat")}
                />
              )}
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground outline-none transition hover:border-emerald-400 hover:text-foreground focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.97]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {t.booking.manageCategories}
              </button>
            </div>

            {filteredServices.length > 0 ? (
              <div className={gridClass}>{filteredServices.map(renderCard)}</div>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
                {t.booking.noServicesDesc}
              </p>
            )}
          </div>

          {/* Booking page options — global settings, kept apart from the catalog. */}
          <section className="rounded-2xl border border-border bg-background p-5">
            <h3 className="mb-3 font-semibold">{t.booking.bookingOptionsSection}</h3>
            <div className="divide-y divide-border/60">
              {/* Currency — a single per-widget setting (prices are entered per
                  service but all share one currency). Drives the symbol shown
                  next to every price on the public widget and dashboard. */}
              <div className="flex items-start justify-between gap-4 py-3 first:pt-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.booking.currencyLabel}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.booking.currencyDesc}</p>
                </div>
                <OptionSelect
                  aria-label={t.booking.currencyLabel}
                  value={config.currency}
                  onChange={(e) => setConfig((c) => ({ ...c, currency: e.target.value }))}
                >
                  {WIDGET_CURRENCIES.map((cur) => (
                    <option key={cur.code} value={cur.code}>
                      {cur.symbol} · {cur.label} ({cur.code.toUpperCase()})
                    </option>
                  ))}
                </OptionSelect>
              </div>
              <ToggleRow
                label={t.booking.showPricesLabel}
                desc={t.booking.showPricesDesc}
                checked={config.show_prices}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, show_prices: v }))}
              />
              {/* Address capture — only relevant for some businesses (e.g. mobile /
                  at-home services), so both showing the field and requiring it are
                  owner-controlled. Requiring is nested under (and cleared with)
                  collecting so a hidden field can never be marked required. */}
              <ToggleRow
                label={t.booking.collectAddressLabel}
                desc={t.booking.collectAddressDesc}
                checked={config.collect_address}
                onCheckedChange={(v) =>
                  setConfig((c) => ({
                    ...c,
                    collect_address: v,
                    address_required: v ? c.address_required : false,
                  }))
                }
              >
                {config.collect_address && (
                  <div className="mt-3 border-l-2 border-border pl-4">
                    <ToggleRow
                      label={t.booking.addressRequiredLabel}
                      desc={t.booking.addressRequiredDesc}
                      checked={config.address_required}
                      onCheckedChange={(v) => setConfig((c) => ({ ...c, address_required: v }))}
                      flush
                    />
                  </div>
                )}
              </ToggleRow>
              <ToggleRow
                label={t.booking.whatsappReminderLabel}
                desc={t.booking.whatsappReminderDesc}
                checked={config.whatsapp_reminder}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, whatsapp_reminder: v }))}
              >
                {/* Lead time — only meaningful while the reminder is on. */}
                {config.whatsapp_reminder && (
                  <div className="mt-3 flex items-start justify-between gap-4 border-l-2 border-border pl-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t.booking.whatsappReminderTimingLabel}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.booking.whatsappReminderTimingDesc}
                      </p>
                    </div>
                    <OptionSelect
                      aria-label={t.booking.whatsappReminderTimingLabel}
                      value={config.whatsapp_reminder_hours}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          whatsapp_reminder_hours: Number(e.target.value) as WhatsAppReminderHours,
                        }))
                      }
                    >
                      {WHATSAPP_REMINDER_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {t.booking.whatsappReminderHoursOption.replace("{hours}", String(h))}
                        </option>
                      ))}
                    </OptionSelect>
                  </div>
                )}
                {/* Number behind the reminder's "Message us" button. */}
                {config.whatsapp_reminder && (
                  <div className="mt-3 border-l-2 border-border pl-4">
                    <p className="text-sm font-medium">{t.booking.whatsappContactLabel}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.booking.whatsappContactDesc}</p>
                    <Input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+39 333 123 4567"
                      aria-label={t.booking.whatsappContactLabel}
                      className="mt-2 max-w-xs"
                      value={config.whatsapp_contact_phone}
                      onChange={(e) => setConfig((c) => ({ ...c, whatsapp_contact_phone: e.target.value }))}
                    />
                  </div>
                )}
              </ToggleRow>
            </div>
          </section>
        </div>
      )}

      {/* Category manager — off the main view so the catalog stays a clean grid.
          Renders via portal, so its placement here is only logical, not visual. */}
      <Dialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title={t.booking.categoriesSection}
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{t.booking.categoriesSectionDesc}</p>
          {scope.categories.length > 0 ? (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {scope.categories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-2">
                  <Input
                    value={cat.name}
                    onChange={(e) => renameCategory(cat.id, e.target.value)}
                    placeholder={t.booking.categoryNamePlaceholder}
                    className="h-9"
                  />
                  <button
                    type="button"
                    onClick={() => removeCategory(cat.id)}
                    aria-label={t.booking.removeCategoryAria}
                    className="shrink-0 rounded-lg p-2 text-muted-foreground outline-none transition hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-emerald-400 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
              {t.booking.noCategoriesYet}
            </p>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={createCategory}>
            <Plus className="h-4 w-4" /> {t.booking.newCategory}
          </Button>
        </div>
      </Dialog>

      <SaveBar saving={saving} status={status} onSave={handleSave} />
    </div>
  );
}

// A category filter chip: label + count, with a filled active state. Selecting
// one scopes the service grid to that bucket.
function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium outline-none transition active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-emerald-400 ${
        active
          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-border text-muted-foreground hover:border-emerald-400 hover:text-foreground"
      }`}
    >
      <span className="max-w-[10rem] truncate">{label}</span>
      <span
        className={`tabular-nums ${active ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-muted-foreground/70"}`}
      >
        {count}
      </span>
    </button>
  );
}

// A settings row: label + description on the left, a Switch on the right.
// `flush` drops the vertical padding for nested use inside another box.
// `children` renders below the row (e.g. a dependent sub-toggle).
// Native select with its own chevron: the browser's default arrow sits flush
// against the border and is barely visible on the dark theme.
function OptionSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative mt-0.5 shrink-0">
      <select
        {...props}
        className={`h-9 cursor-pointer appearance-none rounded-lg border border-input bg-transparent pl-3 pr-9 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50 dark:bg-input/30 ${className ?? ""}`}
      />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onCheckedChange,
  flush = false,
  children,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  flush?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={flush ? "" : "py-3 first:pt-0 last:pb-0"}>
      <label className="flex cursor-pointer items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5" />
      </label>
      {children}
    </div>
  );
}
