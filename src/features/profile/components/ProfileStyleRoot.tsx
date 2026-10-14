"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ProfileStyleContext,
  type ProfileStyle,
  type ProfileStyleCtx,
} from "@/contexts/ProfileStyleContext";
import { updateProfileStyle } from "../actions/update-background";
import { isColorDark } from "@/lib/color";

// How long the picker must sit idle before the coalesced patch is written.
// Dragging the native color input fires ~60 events/s: without this every tick
// was a server action + revalidate + full RSC refresh, queued one at a time.
const SAVE_DEBOUNCE_MS = 400;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
const safeHex = (c: string | null | undefined) => (c && HEX_COLOR.test(c) ? c : null);

interface ProfileStyleRootProps {
  /** Persisted style from the server render (also re-synced after refreshes). */
  initial: ProfileStyle;
  isOwner: boolean;
  className?: string;
  children: React.ReactNode;
}

// Root of the public profile page. Owns the live profile style so the owner's
// Style picker applies instantly everywhere, then persists it in the background:
//   • updates are applied to local state synchronously (no network wait)
//   • rapid changes are coalesced into ONE debounced write
//   • writes run strictly one after another (never out of order)
//   • a failed write rolls back only the fields nobody has touched since,
//     to the last value the server actually accepted
//   • fresh server props are adopted only when nothing is pending, so a refresh
//     from an older save can't snap the picker back to a previous color
// It also derives the light/dark lock from the LIVE background, so text stays
// legible while previewing (the server computes the same class for first paint).
export function ProfileStyleRoot({ initial, isOwner, className = "", children }: ProfileStyleRootProps) {
  const [style, setStyle] = useState<ProfileStyle>(initial);
  const [saveError, setSaveError] = useState(false);

  const lastSaved = useRef<ProfileStyle>(initial);
  const pending = useRef<Partial<ProfileStyle>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  const isIdle = () =>
    !inFlight.current && timer.current === null && Object.keys(pending.current).length === 0;

  const flush = useCallback(async () => {
    timer.current = null;
    if (inFlight.current) return; // the running loop picks the new patch up
    inFlight.current = true;
    // Drain: anything edited while a save was in flight is written next (unless
    // a debounce timer is pending again, which will flush it itself).
    while (Object.keys(pending.current).length > 0 && timer.current === null) {
      const patch = pending.current;
      pending.current = {};

      let ok = false;
      try {
        const result = await updateProfileStyle(patch);
        ok = result.ok;
        if (!result.ok) console.error("[profile] style save failed:", result);
      } catch (err) {
        console.error("[profile] style save failed:", err);
      }

      if (ok) {
        lastSaved.current = { ...lastSaved.current, ...patch };
        setSaveError(false);
      } else {
        // Roll back only fields that haven't been edited again since this patch.
        const revert: Partial<ProfileStyle> = {};
        for (const key of Object.keys(patch) as (keyof ProfileStyle)[]) {
          if (!(key in pending.current)) {
            (revert as Record<string, unknown>)[key] = lastSaved.current[key];
          }
        }
        setStyle((s) => ({ ...s, ...revert }));
        setSaveError(true);
      }
    }
    inFlight.current = false;
  }, []);

  const update = useCallback(
    (patch: Partial<ProfileStyle>) => {
      if (!isOwner) return;
      setStyle((s) => ({ ...s, ...patch }));
      Object.assign(pending.current, patch);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    },
    [isOwner, flush]
  );

  // Leaving the page with an unsaved patch: write it now instead of dropping it.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void flush();
      }
    },
    [flush]
  );

  // Adopt fresh server values (another tab, a refresh after "Edit info", …) —
  // but only while idle, so they never overwrite the owner's newer edits.
  const initialKey = JSON.stringify(initial);
  useEffect(() => {
    if (!isIdle()) return;
    lastSaved.current = initial;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external (server) value sync, guarded against pending local edits
    setStyle(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialized value, not object identity
  }, [initialKey]);

  const ctx = useMemo<ProfileStyleCtx>(() => ({ style, update, saveError }), [style, update, saveError]);

  const bg = safeHex(style.backgroundColor);
  const theme = bg ? (isColorDark(bg) ? "dark" : "light") : "";

  return (
    <ProfileStyleContext.Provider value={ctx}>
      <div data-profile-root className={`${className} ${theme}`}>
        {/* Paint the document itself with the profile color so overscroll, the
            area behind the floating CTA / Safari toolbars and any space below
            the content never flashes the app's white (or dark-mode) body.
            Scoped to this page: it unmounts on navigation. Only `html` gets the
            color; `body` must go transparent — once html has its own background,
            body's stops propagating to the canvas and would paint as an opaque
            box OVER the negative-z cover image. Dropped the moment a link away
            is tapped (see ThemeColorSync) so the status bar reverts instantly. */}
        {bg && (
          <style>{`html:not([data-nav-leaving]){background-color:${bg}}html:not([data-nav-leaving]) body{background-color:transparent}`}</style>
        )}
        {children}
      </div>
    </ProfileStyleContext.Provider>
  );
}
