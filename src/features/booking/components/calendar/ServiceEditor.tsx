"use client";

import { ArrowLeft, Check, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CalendarCategory, CalendarService, StaffMember } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  service: CalendarService;
  staff: StaffMember[];
  categories: CalendarCategory[];
  currencySymbol: string; // symbol shown next to the price field (owner-selected)
  onBack: () => void;
  onUpdate: (id: string, fields: Partial<CalendarService>) => void;
  onRemove: (id: string) => void;
  onToggleStaff: (serviceId: string, staffId: string) => void;
}

// Detail view: the full single-service editor (name, duration, price, who can
// perform, delete). Consumes the CRUD helpers owned by ServicesManager so the
// data model and save path stay untouched. Mirrors StaffEditor's structure.
export function ServiceEditor({ service, staff, categories, currencySymbol, onBack, onUpdate, onRemove, onToggleStaff }: Props) {
  const { t } = useLanguage();

  // Bordered field shell that mirrors <Input>'s focus ring, so the adorned
  // number fields (duration / price) sit flush with the plain name input.
  const fieldShell =
    "flex h-9 items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30";
  const bareNumber = "min-w-0 bg-transparent tabular-nums outline-none placeholder:text-muted-foreground";

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <ArrowLeft className="h-4 w-4" /> {t.booking.backToServices}
      </button>

      <section className="rounded-2xl border border-border bg-background p-5 space-y-6">
        {/* Name */}
        <div className="space-y-1">
          <label htmlFor={`svc-name-${service.id}`} className="text-xs font-medium text-muted-foreground">
            {t.booking.nameLabel}
          </label>
          <Input
            id={`svc-name-${service.id}`}
            className="h-9 w-full text-base font-medium"
            value={service.name}
            onChange={(e) => onUpdate(service.id, { name: e.target.value })}
            placeholder={t.booking.servicePlaceholder}
          />
        </div>

        {/* Category — which grouping this service sorts under, in the manager and
            the public widget. Hidden until the owner has created a category. */}
        {categories.length > 0 && (
          <div className="space-y-1">
            <label htmlFor={`svc-cat-${service.id}`} className="text-xs font-medium text-muted-foreground">
              {t.booking.categoryLabel}
            </label>
            <select
              id={`svc-cat-${service.id}`}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50 dark:bg-input/30"
              value={service.category_id ?? ""}
              onChange={(e) => onUpdate(service.id, { category_id: e.target.value || null })}
            >
              <option value="">{t.booking.noCategoryOption}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name?.trim() || t.booking.categoryNamePlaceholder}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Duration + price */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor={`svc-dur-${service.id}`} className="text-xs font-medium text-muted-foreground">
              {t.booking.durationLabel}
            </label>
            <div className={fieldShell}>
              <input
                id={`svc-dur-${service.id}`}
                type="number"
                min={5}
                step={5}
                className={`${bareNumber} w-full`}
                value={service.duration_min}
                onChange={(e) => onUpdate(service.id, { duration_min: Number(e.target.value) })}
              />
              <span className="shrink-0 text-muted-foreground">{t.booking.minSuffix}</span>
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor={`svc-price-${service.id}`} className="text-xs font-medium text-muted-foreground">
              {t.booking.priceLabel}
            </label>
            <div className={fieldShell}>
              <span className="shrink-0 text-muted-foreground">{currencySymbol}</span>
              <input
                id={`svc-price-${service.id}`}
                type="number"
                min={0}
                step={1}
                className={`${bareNumber} w-full`}
                value={service.price_cents != null ? (service.price_cents / 100).toString() : ""}
                onChange={(e) =>
                  onUpdate(service.id, {
                    price_cents: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100),
                  })
                }
                placeholder={t.booking.freePlaceholder}
              />
            </div>
          </div>
        </div>

        {/* Who can perform this service. Empty ⇒ anyone. */}
        {staff.length > 0 && (
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div>
              <h3 className="text-sm font-medium">{t.booking.whoCanPerform}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.booking.whoCanPerformHint}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {staff.map((st) => {
                const on = (service.staff_ids ?? []).includes(st.id);
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => onToggleStaff(service.id, st.id)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium transition active:scale-[0.97] ${
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

        {/* Parallel — whether this service can run concurrently with others in a
            multi-service booking (each handled by its own staff). Only meaningful
            when the business has staff; a single resource can't parallelize. */}
        {staff.length > 0 && (
          <label
            htmlFor={`svc-parallel-${service.id}`}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-4"
          >
            <input
              id={`svc-parallel-${service.id}`}
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
              checked={!!service.parallel}
              onChange={(e) => onUpdate(service.id, { parallel: e.target.checked })}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{t.booking.parallelLabel}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t.booking.parallelHint}</span>
            </span>
          </label>
        )}

        {/* Danger zone */}
        <div className="flex justify-end border-t border-border pt-4">
          <Button variant="destructive" size="sm" onClick={() => onRemove(service.id)}>
            <Trash2 className="h-4 w-4" /> {t.booking.deleteService}
          </Button>
        </div>
      </section>
    </div>
  );
}
