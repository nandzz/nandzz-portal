"use client";

import { useRef, useState } from "react";
import { Loader2, Plus, Trash2, Check, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarCropModal } from "@/components/ui/AvatarCropModal";
import type { StaffMember, WeekdayKey } from "@/lib/types";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/lib/widgets/calendar";
import { createClient } from "@/lib/supabase/client";
import type { CalendarConfigController } from "@/components/widgets/calendar/useCalendarConfig";

// Profile pictures must be under this size (mirrors ProfileHeader's uploader).
const MAX_STAFF_PHOTO_SIZE = 1.5 * 1024 * 1024;

const inputCls = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm";

interface Props {
  controller: CalendarConfigController;
}

// Top-level Staff tab: staff roster CRUD (photo, name, info, per-staff weekly
// availability and days off). Consumes the shared config controller so its saves
// stay in lockstep with the Settings studio (which edits per-service staff_ids).
export function StaffManager({ controller }: Props) {
  const { config, setConfig, saving, status, save } = controller;

  // Staff photo upload: a single hidden file input is shared across cards; the
  // in-flight staff id tracks which card the picked/cropped image belongs to.
  const photoInputRef = useRef<HTMLInputElement>(null);
  const ownerIdRef = useRef<string | null>(null);
  const [photoStaffId, setPhotoStaffId] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [uploadingStaffId, setUploadingStaffId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // ── staff ──
  function addStaff() {
    const member: StaffMember = {
      id: `stf_${Math.random().toString(36).slice(2, 9)}`,
      name: "New staff member",
      availability: {},
    };
    setConfig((c) => ({ ...c, staff: [...c.staff, member] }));
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

  return (
    <div className="space-y-6">
      {/* Shared staff-photo picker + crop modal (opened per-card). */}
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

      <div className="space-y-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Staff</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The people who take bookings. Each keeps their own hours and days off. Leave empty to run as a
            single bookable resource.
          </p>
        </div>
        <section className="rounded-2xl border border-border bg-background p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Team members</h2>
            <Button variant="outline" size="sm" onClick={addStaff}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          {photoError && <p className="text-xs text-red-600">{photoError}</p>}
          {config.staff.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No staff yet. Bookings run against your business hours as a single resource.
            </p>
          )}

          <div className="space-y-4">
            {config.staff.map((st) => (
              <div key={st.id} className="rounded-xl border border-border p-4 space-y-4">
                {/* Header: photo + name + remove */}
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => openPhotoPicker(st.id)}
                    disabled={uploadingStaffId === st.id}
                    aria-label={`Change ${st.name || "staff"} photo`}
                    className="group relative shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <Avatar size="lg" className="h-14 w-14">
                      <AvatarImage src={st.photo_url || undefined} />
                      <AvatarFallback className="text-base">
                        {st.name?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">
                      {uploadingStaffId === st.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </span>
                  </button>
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        className={`${inputCls} flex-1 min-w-[8rem]`}
                        value={st.name}
                        onChange={(e) => updateStaff(st.id, { name: e.target.value })}
                        placeholder="Full name"
                      />
                      <button
                        onClick={() => removeStaff(st.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-red-600"
                        aria-label="Remove staff member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <textarea
                      className={`${inputCls} w-full resize-y`}
                      rows={2}
                      value={st.info ?? ""}
                      onChange={(e) => updateStaff(st.id, { info: e.target.value })}
                      placeholder="Short role or bio (e.g. Senior stylist) — shown to visitors when they pick a provider."
                    />
                  </div>
                </div>

                {/* Per-staff weekly availability */}
                <div className="space-y-2 rounded-lg border border-border/60 p-3">
                  <h3 className="text-sm font-medium">Weekly availability</h3>
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="flex flex-wrap items-start gap-3 border-b border-border/50 py-2 last:border-0">
                      <span className="w-24 pt-1.5 text-sm font-medium">{WEEKDAY_LABELS[day]}</span>
                      <div className="flex flex-1 flex-wrap gap-2">
                        {(st.availability[day] ?? []).map((w, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <input
                              type="time"
                              className={inputCls}
                              value={w[0]}
                              onChange={(e) => updateStaffWindow(st.id, day, idx, 0, e.target.value)}
                            />
                            <span className="text-muted-foreground">–</span>
                            <input
                              type="time"
                              className={inputCls}
                              value={w[1]}
                              onChange={(e) => updateStaffWindow(st.id, day, idx, 1, e.target.value)}
                            />
                            <button
                              onClick={() => removeStaffWindow(st.id, day, idx)}
                              className="rounded p-1 text-muted-foreground hover:text-red-600"
                              aria-label="Remove window"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addStaffWindow(st.id, day)}
                          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-emerald-400 hover:text-foreground"
                        >
                          <Plus className="h-3 w-3" /> Add hours
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Per-staff days off */}
                <div className="space-y-2 rounded-lg border border-border/60 p-3">
                  <h3 className="text-sm font-medium">Days off</h3>
                  <div className="flex flex-wrap gap-2">
                    {(st.blackout_dates ?? []).map((d) => (
                      <span key={d} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-sm">
                        {d}
                        <button
                          onClick={() => removeStaffDayOff(st.id, d)}
                          className="text-muted-foreground hover:text-red-600"
                          aria-label="Remove day off"
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
                      if (d && !(st.blackout_dates ?? []).includes(d)) addStaffDayOff(st.id, d);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Save bar — persists the whole shared config via the controller, so saving
          here also commits any Settings edits and vice versa. */}
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
