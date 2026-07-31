"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Camera, X, Move, Check, Share2, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MAX_BG_SIZE = 1.5 * 1024 * 1024;

function parsePosition(pos: string | null): { x: number; y: number } {
  if (!pos) return { x: 50, y: 50 };
  const parts = pos.replace(/%/g, "").trim().split(/\s+/).map(Number);
  return { x: parts[0] ?? 50, y: parts[1] ?? 50 };
}

interface ProfileBackgroundProps {
  backgroundUrl: string | null;
  backgroundPosition: string | null;
  isOwner: boolean;
  profileId: string;
  username: string;
  displayName: string;
}

export function ProfileBackground({
  backgroundUrl,
  backgroundPosition,
  isOwner,
  profileId,
  username,
  displayName,
}: ProfileBackgroundProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Local URL so remove/replace reflects instantly without waiting for router.refresh()
  const [localUrl, setLocalUrl] = useState(backgroundUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [repositioning, setRepositioning] = useState(false);

  const initPos = parsePosition(backgroundPosition);
  const [position, setPosition] = useState(initPos);       // live drag state
  const [savedPosition, setSavedPosition] = useState(initPos); // last saved state

  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/${username}`
      : `/${username}`;
    if (navigator.share) {
      try { await navigator.share({ url, title: `${displayName} on Nandzz` }); return; }
      catch { /* user cancelled — fall through */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  const isDragging = useRef(false);
  const dragStart = useRef({ clientX: 0, clientY: 0, posX: 50, posY: 50 });

  // Keep local state in sync when the server re-renders with fresh props
  useEffect(() => { setLocalUrl(backgroundUrl); }, [backgroundUrl]);
  useEffect(() => {
    const p = parsePosition(backgroundPosition);
    setPosition(p);
    setSavedPosition(p);
  }, [backgroundPosition]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BG_SIZE) {
      setError("Background image must be under 1.5 MB");
      e.target.value = "";
      return;
    }

    setError("");
    setUploading(true);

    try {
      // Delete any existing background files so storage doesn't accumulate
      const { data: existing } = await supabase.storage
        .from("profile-backgrounds")
        .list(profileId);

      if (existing && existing.length > 0) {
        await supabase.storage
          .from("profile-backgrounds")
          .remove(existing.map((f) => `${profileId}/${f.name}`));
      }

      // Timestamp in filename = unique URL each upload = no browser cache issue
      const ext = file.name.split(".").pop() ?? "jpg";
      const filePath = `${profileId}/background-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-backgrounds")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("profile-backgrounds")
        .getPublicUrl(filePath);

      const resetPos = { x: 50, y: 50 };
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ background_url: publicUrl, background_position: "50% 50%" })
        .eq("id", profileId);

      if (updateError) throw updateError;

      setLocalUrl(publicUrl);
      setPosition(resetPos);
      setSavedPosition(resetPos);
      // Enter reposition mode right away so the user can frame the shot
      setRepositioning(true);
      // Invalidate the profile page's unstable_cache tag BEFORE router.refresh(),
      // otherwise the server re-render returns the stale background_url and the
      // useEffect below snaps localUrl back to the old value.
      await fetch("/api/profile/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // ── Remove ────────────────────────────────────────────────────────────────
  const handleRemove = async () => {
    setUploading(true);
    setError("");
    try {
      const { data: existing } = await supabase.storage
        .from("profile-backgrounds")
        .list(profileId);

      if (existing && existing.length > 0) {
        await supabase.storage
          .from("profile-backgrounds")
          .remove(existing.map((f) => `${profileId}/${f.name}`));
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ background_url: null, background_position: null })
        .eq("id", profileId);

      if (updateError) throw updateError;

      // Update local state immediately — no waiting for router.refresh()
      setLocalUrl(null);
      setPosition({ x: 50, y: 50 });
      setSavedPosition({ x: 50, y: 50 });
      setRepositioning(false);
      await fetch("/api/profile/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove background");
    } finally {
      setUploading(false);
    }
  };

  // ── Drag to reposition ────────────────────────────────────────────────────
  // The reposition overlay lives OUTSIDE the -z-10 div so pointer events work.
  // setPointerCapture keeps tracking even when the cursor leaves the element.
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDragging.current = true;
    dragStart.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || !overlayRef.current) return;
    const { width, height } = overlayRef.current.getBoundingClientRect();
    const dx = e.clientX - dragStart.current.clientX;
    const dy = e.clientY - dragStart.current.clientY;
    // Dragging right → show more of the left side → x decreases
    const newX = Math.max(0, Math.min(100, dragStart.current.posX - (dx / width) * 100));
    const newY = Math.max(0, Math.min(100, dragStart.current.posY - (dy / height) * 100));
    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const handleSavePosition = async () => {
    try {
      const posStr = `${Math.round(position.x)}% ${Math.round(position.y)}%`;
      const { error } = await supabase
        .from("profiles")
        .update({ background_position: posStr })
        .eq("id", profileId);
      if (error) throw error;
      setSavedPosition(position);
      setRepositioning(false);
      await fetch("/api/profile/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save position");
    }
  };

  const handleCancelReposition = () => {
    setPosition(savedPosition);
    setRepositioning(false);
  };

  const savedPosStr = `${savedPosition.x}% ${savedPosition.y}%`;
  const livePosStr  = `${position.x}% ${position.y}%`;

  return (
    <>
      {/* ── Decorative background — kept at -z-10, never interactive ── */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {localUrl ? (
          <>
            <div
              className="absolute inset-x-0 top-0 h-72"
              style={{
                backgroundImage: `url(${localUrl})`,
                backgroundSize: "cover",
                backgroundPosition: savedPosStr,
              }}
            />
            <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-background/40 via-background/70 to-background pointer-events-none" />
          </>
        ) : (
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-violet-100/40 blur-3xl dark:bg-violet-950/20" />
        )}
      </div>

      {/* ── Reposition overlay — sibling of -z-10, so pointer events work ── */}
      {repositioning && localUrl && (
        <div
          ref={overlayRef}
          className="absolute inset-x-0 top-0 h-72 z-20 cursor-grab active:cursor-grabbing select-none touch-none"
          style={{
            backgroundImage: `url(${localUrl})`,
            backgroundSize: "cover",
            backgroundPosition: livePosStr,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Dark tint + hint label */}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-sm px-4 py-2 text-white/90 text-sm font-medium">
              <Move className="h-4 w-4" />
              Drag to reposition
            </div>
          </div>
        </div>
      )}

      {/* ── Edit controls — always a sibling so z-index is unaffected ── */}
      {isOwner && (
        <div className={`absolute top-4 right-4 flex flex-col items-end gap-1.5 ${repositioning ? "z-30" : "z-10"}`}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          {repositioning ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCancelReposition}
                className="flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 px-2.5 py-1.5 text-xs text-white/80 hover:text-white transition-all shadow-sm"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
              <button
                onClick={handleSavePosition}
                className="flex items-center gap-1.5 rounded-full bg-violet-600/90 backdrop-blur-sm border border-violet-400/40 px-3 py-1.5 text-xs text-white hover:bg-violet-600 transition-all shadow-sm"
              >
                <Check className="h-3.5 w-3.5" />
                Save position
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={uploading}
                  className="flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-violet-500/50 transition-all shadow-sm"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {uploading ? "Uploading…" : "Edit"}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <Camera className="h-3.5 w-3.5 mr-2" />
                    {localUrl ? "Change cover" : "Add cover"}
                  </DropdownMenuItem>
                  {localUrl && (
                    <>
                      <DropdownMenuItem onClick={() => { setPosition(savedPosition); setRepositioning(true); }}>
                        <Move className="h-3.5 w-3.5 mr-2" />
                        Reposition
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleRemove}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Remove cover
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                onClick={handleShare}
                className={`flex items-center gap-1.5 rounded-full backdrop-blur-sm border px-3 py-1.5 text-xs transition-all shadow-sm ${
                  copied
                    ? "bg-green-500/15 border-green-500/40 text-green-600 dark:text-green-400"
                    : "bg-background/80 border-border/60 text-muted-foreground hover:text-foreground hover:border-violet-500/50"
                }`}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Share"}
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive bg-background/90 rounded-md px-2 py-1 border border-destructive/20 shadow-sm">
              {error}
            </p>
          )}
        </div>
      )}
    </>
  );
}
