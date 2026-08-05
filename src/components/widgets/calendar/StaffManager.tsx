"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Plus, Check, Search, Users, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvatarCropModal } from "@/components/ui/AvatarCropModal";
import type { StaffMember, WeekdayKey } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import type { CalendarConfigController } from "@/components/widgets/calendar/useCalendarConfig";
import { StaffCard } from "@/components/widgets/calendar/StaffCard";
import { StaffEditor } from "@/components/widgets/calendar/StaffEditor";

// Profile pictures must be under this size (mirrors ProfileHeader's uploader).
const MAX_STAFF_PHOTO_SIZE = 1.5 * 1024 * 1024;

interface Props {
  controller: CalendarConfigController;
}

type Mode = "list" | "edit";

// Top-level Staff tab: a master–detail roster. The LIST view is a searchable grid
// of cards; clicking one (or creating) opens the EDIT view — the full per-member
// editor (photo, name, info, weekly availability, days off). Consumes the shared
// config controller so its saves stay in lockstep with the Settings studio (which
// edits per-service staff_ids). The data model, controller and save path are
// untouched — only the presentation changed.
export function StaffManager({ controller }: Props) {
  const { config, setConfig, saving, status, save } = controller;

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

  // ── staff ──
  function createStaff() {
    const member: StaffMember = {
      id: `stf_${Math.random().toString(36).slice(2, 9)}`,
      name: "New staff member",
      availability: {},
    };
    setConfig((c) => ({ ...c, staff: [...c.staff, member] }));
    // Jump straight into the editor for the fresh member.
    setEditingStaffId(member.id);
    setMode("edit");
  }
  function updateStaff(id: string, fields: Partial<StaffMember>) {
    setConfig((c) => ({ ...c, staff: c.staff.map((s) => (s.id === id ? { ...s, ...fields } : s)) }));
  }
  function removeStaff(id: string) {
    // Also drop dangling references from any service allow-lists.
    setConfig((c) => ({
      ...c,
      staff: c.staff.filter((s) => s.id !== id),
      services: c.services.map((s) =>
        s.staff_ids?.includes(id) ? { ...s, staff_ids: s.staff_ids.filter((x) => x !== id) } : s
      ),
    }));
    // Deleting always returns to the roster.
    if (editingStaffId === id) {
      setEditingStaffId(null);
      setMode("list");
    }
  }

  // Per-staff weekly availability (mirrors the business-hours addWindow/updateWindow/removeWindow).
  function addStaffWindow(staffId: string, day: WeekdayKey) {
    setConfig((c) => ({
      ...c,
      staff: c.staff.map((s) =>
        s.id === staffId
          ? {
              ...s,
              availability: {
                ...s.availability,
                [day]: [...(s.availability[day] ?? []), ["09:00", "17:00"] as [string, string]],
              },
            }
          : s
      ),
    }));
  }
  function updateStaffWindow(staffId: string, day: WeekdayKey, idx: number, which: 0 | 1, value: string) {
    setConfig((c) => ({
      ...c,
      staff: c.staff.map((s) =>
        s.id === staffId
          ? {
              ...s,
              availability: {
                ...s.availability,
                [day]: (s.availability[day] ?? []).map((w, i) =>
                  i === idx ? ((which === 0 ? [value, w[1]] : [w[0], value]) as [string, string]) : w
                ),
              },
            }
          : s
      ),
    }));
  }
  function removeStaffWindow(staffId: string, day: WeekdayKey, idx: number) {
    setConfig((c) => ({
      ...c,
      staff: c.staff.map((s) =>
        s.id === staffId
          ? {
              ...s,
              availability: {
                ...s.availability,
                [day]: (s.availability[day] ?? []).filter((_, i) => i !== idx),
              },
            }
          : s
      ),
    }));
  }
  // Per-staff days off (mirrors the blackout-dates chip pattern).
  function addStaffDayOff(staffId: string, date: string) {
    setConfig((c) => ({
      ...c,
      staff: c.staff.map((s) =>
        s.id === staffId
          ? { ...s, blackout_dates: [...(s.blackout_dates ?? []), date].sort() }
          : s
      ),
    }));
  }
  function removeStaffDayOff(staffId: string, date: string) {
    setConfig((c) => ({
      ...c,
      staff: c.staff.map((s) =>
        s.id === staffId
          ? { ...s, blackout_dates: (s.blackout_dates ?? []).filter((d) => d !== date) }
          : s
      ),
    }));
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
      setPhotoError("Photo must be under 1.5 MB.");
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
      const supabase = createClient();
      // Storage RLS on the `avatars` bucket requires the first path segment to
      // equal the owner's auth uid, so every staff photo lives under it.
      let ownerId = ownerIdRef.current;
      if (!ownerId) {
        const { data } = await supabase.auth.getUser();
        ownerId = data.user?.id ?? null;
        ownerIdRef.current = ownerId;
      }
      if (!ownerId) throw new Error("Not signed in.");
      const filePath = `${ownerId}/staff/${staffId}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      // Cache-bust: the storage path is stable across re-uploads.
      updateStaff(staffId, { photo_url: `${publicUrlData.publicUrl}?t=${Date.now()}` });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setUploadingStaffId(null);
      setPhotoStaffId(null);
    }
  }

  // The member currently open in the detail view (may vanish if deleted elsewhere).
  const editingStaff = useMemo(
    () => (mode === "edit" ? config.staff.find((s) => s.id === editingStaffId) ?? null : null),
    [mode, editingStaffId, config.staff]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return config.staff;
    return config.staff.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.info ?? "").toLowerCase().includes(q)
    );
  }, [config.staff, query]);

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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Staff</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The people who take bookings. Each keeps their own hours and days off. Leave empty to run as a
          single bookable resource.
        </p>
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
      ) : config.staff.length === 0 ? (
        // Empty state — no staff yet.
        <div className="rounded-2xl border border-dashed border-border bg-background px-5 py-14 text-center">
          <Users className="mx-auto h-9 w-9 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">No team members yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Add the people who take bookings and give each their own hours. Until you do, bookings run
            against your business hours as a single resource.
          </p>
          <Button className="mt-5" onClick={createStaff}>
            <Plus className="h-4 w-4" /> Create staff member
          </Button>
        </div>
      ) : (
        // List view — searchable grid of cards.
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold">Team members</h3>
              <span className="text-sm text-muted-foreground tabular-nums">
                {config.staff.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search staff…"
                  aria-label="Search staff"
                  className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-8 text-sm outline-none focus:border-emerald-400"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-1.5 text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    ×
                  </button>
                )}
              </div>
              <Button className="shrink-0" onClick={createStaff}>
                <Plus className="h-4 w-4" /> New staff
              </Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            // No-results state (search matched nothing).
            <div className="rounded-2xl border border-border bg-background px-5 py-12 text-center">
              <UserX className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">No staff match “{query}”</p>
              <p className="mt-1 text-xs text-muted-foreground">Try a different name or role.</p>
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
      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-xl border border-border bg-background/90 p-3 backdrop-blur">
        {status && (
          <span className={`text-sm ${status.ok ? "text-emerald-600" : "text-red-600"}`}>
            {status.ok && <Check className="mr-1 inline h-4 w-4" />}
            {status.msg}
          </span>
        )}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </div>
  );
}
