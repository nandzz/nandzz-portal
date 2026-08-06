"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Plus, Check, Search, MapPinned, MapPinX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvatarCropModal } from "@/components/ui/AvatarCropModal";
import type { Location, WeekdayKey } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import type { CalendarConfigController } from "@/components/widgets/calendar/useCalendarConfig";
import { LocationCard } from "@/components/widgets/calendar/LocationCard";
import { LocationEditor } from "@/components/widgets/calendar/LocationEditor";
import { useLanguage } from "@/contexts/LanguageContext";

// Photo files must be under this size (mirrors StaffManager's uploader).
const MAX_LOCATION_PHOTO_SIZE = 1.5 * 1024 * 1024;

interface Props {
  controller: CalendarConfigController;
}

type Mode = "list" | "edit";

// Top-level Locations tab: a master–detail roster, cloned from StaffManager.
// Each location fully owns its own services/staff/availability/blackout_dates
// (edited elsewhere, via the location-scope selector re-targeting the
// existing Services/Staff/Availability sections) — this manager only handles
// the location's own identity: name, address, photo, timezone, and its own
// working hours + days off. Consumes the shared config controller so its
// saves stay in lockstep with the rest of the Settings studio.
export function LocationManager({ controller }: Props) {
  const { t } = useLanguage();
  const { config, setConfig, saving, status, save } = controller;

  // Master–detail navigation (local UI state only — never persisted).
  const [mode, setMode] = useState<Mode>("list");
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Location photo upload: a single hidden file input shared across cards;
  // the in-flight location id tracks which card the picked/cropped image
  // belongs to.
  const photoInputRef = useRef<HTMLInputElement>(null);
  const ownerIdRef = useRef<string | null>(null);
  const [photoLocationId, setPhotoLocationId] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [uploadingLocationId, setUploadingLocationId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // ── locations ──
  function createLocation() {
    const loc: Location = {
      id: `loc_${Math.random().toString(36).slice(2, 9)}`,
      name: t.booking.newLocationDefaultName,
      services: [],
      staff: [],
      availability: {},
    };
    setConfig((c) => ({ ...c, locations: [...c.locations, loc] }));
    // Jump straight into the editor for the fresh location.
    setEditingLocationId(loc.id);
    setMode("edit");
  }
  function updateLocation(id: string, fields: Partial<Location>) {
    setConfig((c) => ({
      ...c,
      locations: c.locations.map((l) => (l.id === id ? { ...l, ...fields } : l)),
    }));
  }
  function removeLocation(id: string) {
    // The location object takes its nested services/staff with it — no
    // cross-refs to scrub elsewhere in config (unlike removeStaff).
    setConfig((c) => ({ ...c, locations: c.locations.filter((l) => l.id !== id) }));
    // Deleting always returns to the roster.
    if (editingLocationId === id) {
      setEditingLocationId(null);
      setMode("list");
    }
  }

  // Per-location weekly hours (mirrors the per-staff addWindow/updateWindow/removeWindow).
  function addLocationWindow(locationId: string, day: WeekdayKey) {
    setConfig((c) => ({
      ...c,
      locations: c.locations.map((l) =>
        l.id === locationId
          ? {
              ...l,
              availability: {
                ...l.availability,
                [day]: [...(l.availability[day] ?? []), ["09:00", "17:00"] as [string, string]],
              },
            }
          : l
      ),
    }));
  }
  function updateLocationWindow(locationId: string, day: WeekdayKey, idx: number, which: 0 | 1, value: string) {
    setConfig((c) => ({
      ...c,
      locations: c.locations.map((l) =>
        l.id === locationId
          ? {
              ...l,
              availability: {
                ...l.availability,
                [day]: (l.availability[day] ?? []).map((w, i) =>
                  i === idx ? ((which === 0 ? [value, w[1]] : [w[0], value]) as [string, string]) : w
                ),
              },
            }
          : l
      ),
    }));
  }
  function removeLocationWindow(locationId: string, day: WeekdayKey, idx: number) {
    setConfig((c) => ({
      ...c,
      locations: c.locations.map((l) =>
        l.id === locationId
          ? {
              ...l,
              availability: {
                ...l.availability,
                [day]: (l.availability[day] ?? []).filter((_, i) => i !== idx),
              },
            }
          : l
      ),
    }));
  }
  // Per-location days off (mirrors the blackout-dates chip pattern).
  function addLocationDayOff(locationId: string, date: string) {
    setConfig((c) => ({
      ...c,
      locations: c.locations.map((l) =>
        l.id === locationId
          ? { ...l, blackout_dates: [...(l.blackout_dates ?? []), date].sort() }
          : l
      ),
    }));
  }
  function removeLocationDayOff(locationId: string, date: string) {
    setConfig((c) => ({
      ...c,
      locations: c.locations.map((l) =>
        l.id === locationId
          ? { ...l, blackout_dates: (l.blackout_dates ?? []).filter((d) => d !== date) }
          : l
      ),
    }));
  }

  // ── navigation ──
  function openEditor(id: string) {
    setPhotoError(null);
    setEditingLocationId(id);
    setMode("edit");
  }
  function backToList() {
    setMode("list");
    setEditingLocationId(null);
    setPhotoError(null);
  }

  // Saving from the editor persists the whole config, then returns to the
  // roster on success (a failed/invalid save keeps you on the location so you
  // can fix it). From the list view it just persists in place.
  async function handleSave() {
    const ok = await save();
    if (ok && mode === "edit") backToList();
  }

  // ── location photo upload (hidden input → crop modal → Supabase Storage) ──
  function openPhotoPicker(locationId: string) {
    setPhotoError(null);
    setPhotoLocationId(locationId);
    photoInputRef.current?.click();
  }
  function handlePhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_LOCATION_PHOTO_SIZE) {
      setPhotoError(t.booking.photoTooLarge);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  }
  async function handleCroppedPhoto(blob: Blob) {
    const locationId = photoLocationId;
    setCropImageSrc(null);
    if (!locationId) return;
    setUploadingLocationId(locationId);
    setPhotoError(null);
    try {
      const supabase = createClient();
      // Storage RLS on the `avatars` bucket requires the first path segment to
      // equal the owner's auth uid, so every location photo lives under it.
      let ownerId = ownerIdRef.current;
      if (!ownerId) {
        const { data } = await supabase.auth.getUser();
        ownerId = data.user?.id ?? null;
        ownerIdRef.current = ownerId;
      }
      if (!ownerId) throw new Error(t.booking.notSignedIn);
      const filePath = `${ownerId}/location/${locationId}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      // Cache-bust: the storage path is stable across re-uploads.
      updateLocation(locationId, { photo_url: `${publicUrlData.publicUrl}?t=${Date.now()}` });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : t.booking.errorUploadPhoto);
    } finally {
      setUploadingLocationId(null);
      setPhotoLocationId(null);
    }
  }

  // The location currently open in the detail view (may vanish if deleted elsewhere).
  const editingLocation = useMemo(
    () => (mode === "edit" ? config.locations.find((l) => l.id === editingLocationId) ?? null : null),
    [mode, editingLocationId, config.locations]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return config.locations;
    return config.locations.filter(
      (l) => l.name.toLowerCase().includes(q) || (l.address ?? "").toLowerCase().includes(q)
    );
  }, [config.locations, query]);

  return (
    <div className="space-y-6">
      {/* Shared location-photo picker + crop modal (opened per-card / from the editor). */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handlePhotoFileChange}
      />
      {cropImageSrc && (
        <AvatarCropModal
          imageSrc={cropImageSrc}
          onCancel={() => {
            setCropImageSrc(null);
            setPhotoLocationId(null);
          }}
          onCrop={handleCroppedPhoto}
        />
      )}

      {/* Section header */}
      <div className="border-b border-border pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.booking.locationsSectionTitle}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.booking.locationsSectionDesc}</p>
      </div>

      {photoError && <p className="text-xs text-red-600">{photoError}</p>}

      {mode === "edit" && editingLocation ? (
        <LocationEditor
          location={editingLocation}
          uploading={uploadingLocationId === editingLocation.id}
          onBack={backToList}
          onOpenPhotoPicker={openPhotoPicker}
          onUpdate={updateLocation}
          onRemove={removeLocation}
          onAddWindow={addLocationWindow}
          onUpdateWindow={updateLocationWindow}
          onRemoveWindow={removeLocationWindow}
          onAddDayOff={addLocationDayOff}
          onRemoveDayOff={removeLocationDayOff}
        />
      ) : config.locations.length === 0 ? (
        // Empty state — no locations yet.
        <div className="rounded-2xl border border-dashed border-border bg-background px-5 py-14 text-center">
          <MapPinned className="mx-auto h-9 w-9 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">{t.booking.noLocationsYetTitle}</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            {t.booking.noLocationsYetDesc}
          </p>
          <Button className="mt-5" onClick={createLocation}>
            <Plus className="h-4 w-4" /> {t.booking.createLocation}
          </Button>
        </div>
      ) : (
        // List view — searchable grid of cards.
        <div className="space-y-4">
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
              <Button className="shrink-0" onClick={createLocation}>
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
                  onDelete={() => removeLocation(l.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save bar — persists the whole shared config via the controller, so saving
          here also commits any Settings/Staff edits and vice versa. Present in both views. */}
      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-xl border border-border bg-background/90 p-3 backdrop-blur">
        {status && (
          <span className={`text-sm ${status.ok ? "text-emerald-600" : "text-red-600"}`}>
            {status.ok && <Check className="mr-1 inline h-4 w-4" />}
            {status.msg}
          </span>
        )}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t.booking.saveChanges}
        </Button>
      </div>
    </div>
  );
}
