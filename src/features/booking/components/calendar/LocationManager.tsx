"use client";

import { useMemo, useState } from "react";
import { Plus, Search, MapPinX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { CalendarConfig, Location } from "@/lib/types";
import type { CalendarConfigController } from "@/features/booking/components/calendar/useCalendarConfig";
import { LocationCard } from "@/features/booking/components/calendar/LocationCard";
import { LocationFormModal } from "@/features/booking/components/calendar/LocationFormModal";
import { BookingSetupGuide } from "@/features/booking/components/calendar/BookingSetupGuide";
import { addFirstLocation } from "@/features/booking/domain/calendar";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  controller: CalendarConfigController;
  // Called after the owner saves their FIRST location (the roster was empty
  // before). WidgetWorkspace uses it to drop them straight into that location's
  // dashboard instead of the "choose a location" gate — nothing to choose yet.
  // `hasServices` is false when it still needs services (next setup step).
  onFirstLocationCreated?: (id: string, hasServices: boolean) => void;
  // Prefill for the first location (the business's own name + address).
  siteDefaults?: { name?: string; address?: string };
}

// Top-level Locations roster: a searchable grid of cards. Creating or editing a
// single location happens in LocationFormModal — a focused modal, so adding a
// location is a deliberate task that never swaps the whole screen out from
// under the owner. Each location fully owns its own services/staff/availability/
// blackout_dates (edited elsewhere, via the location-scope selector re-targeting
// the Services/Staff/Availability sections); this manager only handles the
// location's own identity: name, address, photo, timezone, hours + days off.
export function LocationManager({ controller, onFirstLocationCreated, siteDefaults }: Props) {
  const { t } = useLanguage();
  const { config, setConfig, saving, status, saveWith } = controller;

  const [query, setQuery] = useState("");

  // The location open in the modal (a copy — see LocationFormModal), plus
  // whether it's a not-yet-committed new one. null ⇒ modal closed.
  const [editing, setEditing] = useState<{ location: Location; isNew: boolean } | null>(null);
  // Card trash click → confirm before the (immediate, irreversible) delete.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function openCreate() {
    const first = config.locations.length === 0;
    const loc: Location = {
      id: `loc_${Math.random().toString(36).slice(2, 9)}`,
      name: (first && siteDefaults?.name) || t.booking.newLocationDefaultName,
      address: (first && siteDefaults?.address) || undefined,
      services: [],
      staff: [],
      availability: {},
    };
    setEditing({ location: loc, isNew: true });
  }
  function openEditor(id: string) {
    const loc = config.locations.find((l) => l.id === id);
    if (loc) setEditing({ location: loc, isNew: false });
  }

  // Commit the modal's draft into config and persist it in the same tick
  // (`saveWith` takes the merged config directly, side-stepping the controller's
  // stale closed-over config). On a failed/invalid save the modal stays open so
  // the owner can fix it.
  async function handleModalSave(loc: Location) {
    const wasEmpty = config.locations.length === 0;
    const exists = config.locations.some((l) => l.id === loc.id);
    // The first location adopts a legacy top-level scope (see addFirstLocation).
    const merged: CalendarConfig = exists
      ? { ...config, locations: config.locations.map((l) => (l.id === loc.id ? loc : l)) }
      : addFirstLocation(config, loc);
    setConfig(merged);
    const ok = await saveWith(merged);
    if (!ok) return;
    setEditing(null);
    if (wasEmpty) {
      const saved = merged.locations.find((l) => l.id === loc.id);
      onFirstLocationCreated?.(loc.id, (saved?.services.length ?? 0) > 0);
    }
  }

  async function handleModalDelete(id: string) {
    const merged: CalendarConfig = {
      ...config,
      locations: config.locations.filter((l) => l.id !== id),
    };
    setConfig(merged);
    const ok = await saveWith(merged);
    if (ok) setEditing(null);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return config.locations;
    return config.locations.filter(
      (l) => l.name.toLowerCase().includes(q) || (l.address ?? "").toLowerCase().includes(q)
    );
  }, [config.locations, query]);

  return (
    <div className="space-y-6">
      {editing && (
        <LocationFormModal
          location={editing.location}
          isNew={editing.isNew}
          saving={saving}
          errorMsg={status && !status.ok ? status.msg : null}
          onSave={handleModalSave}
          onDelete={handleModalDelete}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId) return handleModalDelete(confirmDeleteId);
        }}
        title={t.booking.deleteLocation}
        description={t.booking.deleteLocationConfirm}
        confirmLabel={t.booking.deleteLocation}
        cancelLabel={t.booking.cancel}
        variant="destructive"
      />

      {config.locations.length === 0 ? (
        // First run — no locations yet: guided setup instead of a bare roster.
        <BookingSetupGuide onStart={openCreate} />
      ) : (
        // List view — section header + searchable grid of cards.
        <div className="space-y-4">
          <div className="border-b border-border pb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t.booking.locationsSectionTitle}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.booking.locationsSectionDesc}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold">{t.booking.locationsListTitle}</h3>
              <span className="text-sm text-muted-foreground tabular-nums">
                {config.locations.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.booking.searchLocationsPlaceholder}
                  aria-label={t.booking.searchLocationsAria}
                  className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-8 text-sm outline-none focus:border-emerald-400"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label={t.booking.clearSearchAria}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-1.5 text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    ×
                  </button>
                )}
              </div>
              <Button className="shrink-0" onClick={openCreate}>
                <Plus className="h-4 w-4" /> {t.booking.newLocation}
              </Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            // No-results state (search matched nothing).
            <div className="rounded-2xl border border-border bg-background px-5 py-12 text-center">
              <MapPinX className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">
                {t.booking.noLocationMatch.replace("{query}", query)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t.booking.tryDifferentLocationName}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((l) => (
                <LocationCard
                  key={l.id}
                  location={l}
                  onOpen={() => openEditor(l.id)}
                  onDelete={() => setConfirmDeleteId(l.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
