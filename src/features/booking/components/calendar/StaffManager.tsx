"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Search, Users, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvatarCropModal } from "@/components/ui/AvatarCropModal";
import type { StaffMember, WeekdayKey } from "@/lib/types";
import { getCurrentUserId, uploadStaffPhoto } from "@/features/booking/storage";
import { getLocationScope, withLocationScope } from "@/features/booking/domain/calendar";
import type { CalendarConfigController } from "@/features/booking/components/calendar/useCalendarConfig";
import { StaffCard } from "@/features/booking/components/calendar/StaffCard";
import { StaffEditor } from "@/features/booking/components/calendar/StaffEditor";
import { SaveBar } from "@/features/booking/components/calendar/SaveBar";
import { useLanguage } from "@/contexts/LanguageContext";

// Profile pictures must be under this size (mirrors ProfileHeader's uploader).
const MAX_STAFF_PHOTO_SIZE = 1.5 * 1024 * 1024;

interface Props {
  controller: CalendarConfigController;
  // Which location's staff roster is showing. null/undefined ⇒ the legacy
  // top-level config.staff (unchanged behavior — also what's used when
  // config.locations is empty). Picked once up front by WidgetWorkspace's
  // location gate, shared here and with the Settings studio so both stay in
  // sync.
  currentLocationId?: string | null;
}

type Mode = "list" | "edit";

// Top-level Staff tab: a master–detail roster. The LIST view is a searchable grid
// of cards; clicking one (or creating) opens the EDIT view — the full per-member
// editor (photo, name, info, weekly availability, days off). Consumes the shared
// config controller so its saves stay in lockstep with the Settings studio (which
// edits per-service staff_ids). Once the owner has added locations, the roster is
// scoped to the selected location (getLocationScope/withLocationScope) instead of
// the top-level config — the data model, controller and save path are otherwise
// untouched.
export function StaffManager({ controller, currentLocationId = null }: Props) {
  const { t } = useLanguage();
  const { config, setConfig, saving, status, save } = controller;
  const scope = getLocationScope(config, currentLocationId);

  // Master–detail navigation (local UI state only — never persisted).
  const [mode, setMode] = useState<Mode>("list");
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Staff photo upload: a single hidden file input is shared across cards; the
  // in-flight staff id tracks which card the picked/cropped image belongs to.
  const photoInputRef = useRef<HTMLInputElement>(null);
  const ownerIdRef = useRef<string | null>(null);
  const [photoStaffId, setPhotoStaffId] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [uploadingStaffId, setUploadingStaffId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // ── staff ── (scoped to the current location, or the top-level config when
  // currentLocationId is null — see getLocationScope/withLocationScope)
  function createStaff() {
    const member: StaffMember = {
      id: `stf_${Math.random().toString(36).slice(2, 9)}`,
      name: t.booking.newStaffDefaultName,
      availability: {},
    };
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, { staff: [...s.staff, member] });
    });
    // Jump straight into the editor for the fresh member.
    setEditingStaffId(member.id);
    setMode("edit");
  }
  function updateStaff(id: string, fields: Partial<StaffMember>) {
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, {
        staff: s.staff.map((st) => (st.id === id ? { ...st, ...fields } : st)),
      });
    });
  }
  function removeStaff(id: string) {
    // Also drop dangling references from any service allow-lists in the same scope.
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, {
        staff: s.staff.filter((st) => st.id !== id),
        services: s.services.map((sv) =>
          sv.staff_ids?.includes(id) ? { ...sv, staff_ids: sv.staff_ids.filter((x) => x !== id) } : sv
        ),
      });
    });
    // Deleting always returns to the roster.
    if (editingStaffId === id) {
      setEditingStaffId(null);
      setMode("list");
    }
  }

  // Per-staff weekly availability (mirrors the business-hours addWindow/updateWindow/removeWindow).
  function addStaffWindow(staffId: string, day: WeekdayKey) {
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, {
        staff: s.staff.map((st) =>
          st.id === staffId
            ? {
                ...st,
                availability: {
                  ...st.availability,
                  [day]: [...(st.availability[day] ?? []), ["09:00", "17:00"] as [string, string]],
                },
              }
            : st
        ),
      });
    });
  }
  function updateStaffWindow(staffId: string, day: WeekdayKey, idx: number, which: 0 | 1, value: string) {
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, {
        staff: s.staff.map((st) =>
          st.id === staffId
            ? {
                ...st,
                availability: {
                  ...st.availability,
                  [day]: (st.availability[day] ?? []).map((w, i) =>
                    i === idx ? ((which === 0 ? [value, w[1]] : [w[0], value]) as [string, string]) : w
                  ),
                },
              }
            : st
        ),
      });
    });
  }
  function removeStaffWindow(staffId: string, day: WeekdayKey, idx: number) {
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, {
        staff: s.staff.map((st) =>
          st.id === staffId
            ? {
                ...st,
                availability: {
                  ...st.availability,
                  [day]: (st.availability[day] ?? []).filter((_, i) => i !== idx),
                },
              }
            : st
        ),
      });
    });
  }
  // Per-staff days off (mirrors the blackout-dates chip pattern).
  function addStaffDayOff(staffId: string, date: string) {
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, {
        staff: s.staff.map((st) =>
          st.id === staffId
            ? { ...st, blackout_dates: [...(st.blackout_dates ?? []), date].sort() }
            : st
        ),
      });
    });
  }
  function removeStaffDayOff(staffId: string, date: string) {
    setConfig((c) => {
      const s = getLocationScope(c, currentLocationId);
      return withLocationScope(c, currentLocationId, {
        staff: s.staff.map((st) =>
          st.id === staffId
            ? { ...st, blackout_dates: (st.blackout_dates ?? []).filter((d) => d !== date) }
            : st
        ),
      });
    });
  }

  // ── navigation ──
  function openEditor(id: string) {
    setPhotoError(null);
    setEditingStaffId(id);
    setMode("edit");
  }
  function backToList() {
    setMode("list");
    setEditingStaffId(null);
    setPhotoError(null);
  }

  // Saving from the editor persists the whole config, then returns to the roster
  // on success (a failed/invalid save keeps you on the member so you can fix it).
  // From the list view it just persists in place.
  async function handleSave() {
    const ok = await save();
    if (ok && mode === "edit") backToList();
  }

  // ── staff photo upload (hidden input → crop modal → Supabase Storage) ──
  function openPhotoPicker(staffId: string) {
    setPhotoError(null);
    setPhotoStaffId(staffId);
    photoInputRef.current?.click();
  }
  function handlePhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_STAFF_PHOTO_SIZE) {
      setPhotoError(t.booking.photoTooLarge);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  }
  async function handleCroppedPhoto(blob: Blob) {
    const staffId = photoStaffId;
    setCropImageSrc(null);
    if (!staffId) return;
    setUploadingStaffId(staffId);
    setPhotoError(null);
    try {
      // Staff photos live under the owner's auth uid (Storage RLS on `avatars`
      // requires the first path segment to equal it); cached across re-uploads.
      let ownerId = ownerIdRef.current;
      if (!ownerId) {
        ownerId = await getCurrentUserId();
        ownerIdRef.current = ownerId;
      }
      if (!ownerId) throw new Error(t.booking.notSignedIn);
      const photoUrl = await uploadStaffPhoto(ownerId, staffId, blob);
      updateStaff(staffId, { photo_url: photoUrl });
    } catch (err) {
      console.error("[staff] photo upload failed:", err);
      setPhotoError(t.booking.errorUploadPhoto);
    } finally {
      setUploadingStaffId(null);
      setPhotoStaffId(null);
    }
  }

  // The member currently open in the detail view (may vanish if deleted elsewhere).
  const editingStaff = useMemo(
    () => (mode === "edit" ? scope.staff.find((s) => s.id === editingStaffId) ?? null : null),
    [mode, editingStaffId, scope.staff]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scope.staff;
    return scope.staff.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.info ?? "").toLowerCase().includes(q)
    );
  }, [scope.staff, query]);

  return (
    <div className="space-y-6">
      {/* Shared staff-photo picker + crop modal (opened per-card / from the editor). */}
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
            setPhotoStaffId(null);
          }}
          onCrop={handleCroppedPhoto}
        />
      )}

      {/* Section header */}
      <div className="border-b border-border pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.booking.staffSectionTitle}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.booking.staffSectionDesc}</p>
      </div>

      {photoError && <p className="text-xs text-red-600">{photoError}</p>}

      {mode === "edit" && editingStaff ? (
        <StaffEditor
          staff={editingStaff}
          uploading={uploadingStaffId === editingStaff.id}
          onBack={backToList}
          onOpenPhotoPicker={openPhotoPicker}
          onUpdate={updateStaff}
          onRemove={removeStaff}
          onAddWindow={addStaffWindow}
          onUpdateWindow={updateStaffWindow}
          onRemoveWindow={removeStaffWindow}
          onAddDayOff={addStaffDayOff}
          onRemoveDayOff={removeStaffDayOff}
        />
      ) : scope.staff.length === 0 ? (
        // Empty state — no staff yet.
        <div className="rounded-2xl border border-dashed border-border bg-background px-5 py-14 text-center">
          <Users className="mx-auto h-9 w-9 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">{t.booking.noTeamYetTitle}</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            {t.booking.noTeamYetDesc}
          </p>
          <Button className="mt-5" onClick={createStaff}>
            <Plus className="h-4 w-4" /> {t.booking.createStaffMember}
          </Button>
        </div>
      ) : (
        // List view — searchable grid of cards.
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold">{t.booking.teamMembers}</h3>
              <span className="text-sm text-muted-foreground tabular-nums">
                {scope.staff.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.booking.searchStaffPlaceholder}
                  aria-label={t.booking.searchStaffAria}
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
              <Button className="shrink-0" onClick={createStaff}>
                <Plus className="h-4 w-4" /> {t.booking.newStaff}
              </Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            // No-results state (search matched nothing).
            <div className="rounded-2xl border border-border bg-background px-5 py-12 text-center">
              <UserX className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">
                {t.booking.noStaffMatch.replace("{query}", query)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t.booking.tryDifferentNameOrRole}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((st) => (
                <StaffCard
                  key={st.id}
                  staff={st}
                  onOpen={() => openEditor(st.id)}
                  onDelete={() => removeStaff(st.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save bar — persists the whole shared config via the controller, so saving
          here also commits any Settings edits and vice versa. Present in both views. */}
      <SaveBar saving={saving} status={status} onSave={handleSave} />
    </div>
  );
}
