"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera, X, Move, Check, Share2, Pencil, Trash2, UserPen } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditProfileDialog } from "./EditProfileDialog";
import { ProfileStylePicker } from "./ProfileStylePicker";
import { uploadBackground, removeBackgroundFiles } from "../storage";
import {
  updateBackground,
  updateBackgroundPosition,
  updateBackgroundColor,
  updateButtonColor,
  updateTextColor,
  resetProfileStyle,
} from "../actions/update-background";
import type { Profile } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

const MAX_BG_SIZE = 1.5 * 1024 * 1024;

function parsePosition(pos: string | null): { x: number; y: number } {
  if (!pos) return { x: 50, y: 50 };
  const parts = pos.replace(/%/g, "").trim().split(/\s+/).map(Number);
  return { x: parts[0] ?? 50, y: parts[1] ?? 50 };
}

interface ProfileBackgroundProps {
  backgroundUrl: string | null;
  backgroundPosition: string | null;
  backgroundColor: string | null;
  buttonColor: string | null;
  textColor: string | null;
  isOwner: boolean;
  profileId: string;
  username: string;
  displayName: string;
  profile: Profile;
}

export function ProfileBackground({
  backgroundUrl,
  backgroundPosition,
  backgroundColor,
  buttonColor,
  textColor,
  isOwner,
  profileId,
  username,
  displayName,
  profile,
}: ProfileBackgroundProps) {
  const { t } = useLanguage();
  const router = useRouter();
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
  const [editInfoOpen, setEditInfoOpen] = useState(false);

  // Local style colors so swatch selection previews the page background instantly,
  // before the server round-trip / router.refresh reads the persisted value back.
  // (Button color lives on ProfileHeader, so it only reflects after refresh.)
  const [localColor, setLocalColor] = useState(backgroundColor);
  const [localButtonColor, setLocalButtonColor] = useState(buttonColor);
  const [localTextColor, setLocalTextColor] = useState(textColor);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocalColor(backgroundColor); }, [backgroundColor]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocalButtonColor(buttonColor); }, [buttonColor]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocalTextColor(textColor); }, [textColor]);

  // Invalidate the cached profile page then re-render with fresh server data.
  const revalidateProfile = async () => {
    await fetch("/api/profile/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    router.refresh();
  };

  const handleColorChange = async (color: string | null) => {
    const prev = localColor;
    setLocalColor(color); // optimistic preview
    try {
      const result = await updateBackgroundColor({ backgroundColor: color });
      if (!result.ok) throw new Error(result.message || "Failed to save color");
      await revalidateProfile();
    } catch (err) {
      console.error("[profile] background color save failed:", err);
      setLocalColor(prev); // roll back on failure
      setError(t.common.error);
    }
  };

  const handleButtonColorChange = async (color: string | null) => {
    const prev = localButtonColor;
    setLocalButtonColor(color);
    try {
      const result = await updateButtonColor({ buttonColor: color });
      if (!result.ok) throw new Error(result.message || "Failed to save color");
      await revalidateProfile();
    } catch (err) {
      console.error("[profile] button color save failed:", err);
      setLocalButtonColor(prev);
      setError(t.common.error);
    }
  };

  const handleTextColorChange = async (color: string | null) => {
    const prev = localTextColor;
    setLocalTextColor(color);
    try {
      const result = await updateTextColor({ textColor: color });
      if (!result.ok) throw new Error(result.message || "Failed to save color");
      await revalidateProfile();
    } catch (err) {
      console.error("[profile] text color save failed:", err);
      setLocalTextColor(prev);
      setError(t.common.error);
    }
  };

  const handleResetStyle = async () => {
    const prevColor = localColor;
    const prevButton = localButtonColor;
    const prevText = localTextColor;
    setLocalColor(null);
    setLocalButtonColor(null);
    setLocalTextColor(null);
    try {
      const result = await resetProfileStyle();
      if (!result.ok) throw new Error(result.message || "Failed to reset style");
      await revalidateProfile();
    } catch (err) {
      console.error("[profile] style reset failed:", err);
      setLocalColor(prevColor);
      setLocalButtonColor(prevButton);
      setLocalTextColor(prevText);
      setError(t.common.error);
    }
  };

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
  // (prop-sync effects, unchanged from the pre-migration implementation).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocalUrl(backgroundUrl); }, [backgroundUrl]);
  useEffect(() => {
    const p = parsePosition(backgroundPosition);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosition(p);
    setSavedPosition(p);
  }, [backgroundPosition]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BG_SIZE) {
      setError("Background image must be under 1.5 MB");
      e.target.value = "";
      return;
    }

    setError("");
    setUploading(true);

    try {
      // Storage upload (delete-then-upload) stays client-side; see ../storage.
      const publicUrl = await uploadBackground(profileId, file);

      const resetPos = { x: 50, y: 50 };
      const result = await updateBackground({
        backgroundUrl: publicUrl,
        backgroundPosition: "50% 50%",
      });

      if (!result.ok) throw new Error(result.message || "Upload failed");

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
      console.error("[profile] background upload failed:", err);
      setError(t.common.error);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // ── Remove ────────────────────────────────────────────────────────────────
  const handleRemove = async () => {
    if (!window.confirm("Remove your cover image? This can't be undone.")) return;
    setUploading(true);
    setError("");
    try {
      await removeBackgroundFiles(profileId);

      const result = await updateBackground({
        backgroundUrl: null,
        backgroundPosition: null,
      });

      if (!result.ok) throw new Error(result.message || "Failed to remove background");

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
      console.error("[profile] background remove failed:", err);
      setError(t.common.error);
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
      const result = await updateBackgroundPosition({ backgroundPosition: posStr });
      if (!result.ok) throw new Error(result.message || "Failed to save position");
      setSavedPosition(position);
      setRepositioning(false);
      await fetch("/api/profile/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      router.refresh();
    } catch (err) {
      console.error("[profile] background position save failed:", err);
      setError(t.common.error);
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
      {/* ── Custom page color — pinned to the viewport (not the page box), so
          it also fills the space below the content, behind the floating CTA /
          Safari toolbars and the status bar, with no white/dark strip. ── */}
      {localColor && (
        <div
          aria-hidden
          className="fixed inset-0 -z-20 pointer-events-none"
          style={{ backgroundColor: localColor }}
        />
      )}

      {/* ── Decorative background — kept at -z-10, never interactive ── */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {localUrl ? (
          <>
            <div
              className="absolute inset-x-0 top-0 h-[calc(18rem+env(safe-area-inset-top))]"
              style={{
                backgroundImage: `url(${localUrl})`,
                backgroundSize: "cover",
                backgroundPosition: savedPosStr,
              }}
            />
            {/* Cover image fades into the page background. With a custom color we
                fade into that color; otherwise into the theme bg. */}
            <div
              className={`absolute inset-x-0 top-0 h-[calc(18rem+env(safe-area-inset-top))] pointer-events-none ${
                localColor ? "" : "bg-gradient-to-b from-background/20 via-background/50 to-background"
              }`}
              style={
                localColor
                  ? { backgroundImage: `linear-gradient(to bottom, transparent, ${localColor})` }
                  : undefined
              }
            />
          </>
        ) : (
          // No cover image: show the default violet glow only when no custom
          // color is set (the solid color is the backdrop otherwise).
          !localColor && (
            <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-violet-100/40 blur-3xl dark:bg-violet-950/20" />
          )
        )}
      </div>

      {/* ── Reposition overlay — sibling of -z-10, so pointer events work ── */}
      {repositioning && localUrl && (
        <div
          ref={overlayRef}
          className="absolute inset-x-0 top-0 h-[calc(18rem+env(safe-area-inset-top))] z-20 cursor-grab active:cursor-grabbing select-none touch-none"
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

      {/* ── Edit controls — always a sibling so z-index is unaffected ──
          On mobile the logged-in profile pulls the cover up behind the sticky
          navbar (-mt-16 on the page), so these controls must clear the h-16
          navbar (top-20 = navbar + the usual top-4 gap, plus the status-bar inset
          under viewport-fit=cover); desktop has no pull-up. */}
      {isOwner && (
        <div className={`absolute top-[calc(5rem+env(safe-area-inset-top))] right-4 md:top-4 flex flex-col items-end gap-1.5 ${repositioning ? "z-30" : "z-10"}`}>
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
                className="flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 px-2.5 py-1.5 text-xs text-white/80 hover:text-white transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
              <button
                onClick={handleSavePosition}
                className="flex items-center gap-1.5 rounded-full bg-violet-600/90 backdrop-blur-sm border border-violet-400/40 px-3 py-1.5 text-xs text-white hover:bg-violet-600 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
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
                  className="flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-violet-500/50 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {uploading ? "Uploading…" : "Edit"}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setEditInfoOpen(true)}>
                    <UserPen className="h-3.5 w-3.5 mr-2" />
                    Edit info
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
              <ProfileStylePicker
                backgroundColor={localColor}
                onBackgroundChange={handleColorChange}
                buttonColor={localButtonColor}
                onButtonChange={handleButtonColorChange}
                textColor={localTextColor}
                onTextChange={handleTextColorChange}
                onReset={handleResetStyle}
              />
              <button
                onClick={handleShare}
                className={`flex items-center gap-1.5 rounded-full backdrop-blur-sm border px-3 py-1.5 text-xs transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
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

      {isOwner && editInfoOpen && (
        <EditProfileDialog
          onClose={() => setEditInfoOpen(false)}
          profile={profile}
        />
      )}
    </>
  );
}
