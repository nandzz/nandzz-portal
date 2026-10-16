"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// A neighbor panel: an image URL, `undefined` while its data is still loading,
// or `null` when there's no sibling on that side.
type Panel = string | null | undefined;

interface ImageSwipeTrackProps {
  src: string;
  alt: string;
  prev: Panel;
  next: Panel;
  /** Called once the slide-out animation finishes. */
  onCommit: (dir: "prev" | "next") => void;
}

const LOCK_DISTANCE = 8; // px before deciding the gesture's axis
const COMMIT_RATIO = 0.2; // of the width
const COMMIT_VELOCITY = 0.5; // px/ms flick
const EDGE_RESISTANCE = 0.3; // drag factor when there's no sibling that way
const DURATION = 280;

/**
 * Prev / current / next images on a horizontal track that follows the finger
 * (or mouse). Releasing past a threshold — or flicking — slides the neighbor in
 * and commits; otherwise it springs back. Vertical gestures are left to the
 * browser (`touch-action: pan-y`). Remount per space (key by id) to reset.
 */
export function ImageSwipeTrack({ src, alt, prev, next, onCommit }: ImageSwipeTrackProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; t: number; axis: "x" | "y" | null } | null>(null);
  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const committing = useRef<"prev" | "next" | null>(null);

  const settle = (to: number, dir: "prev" | "next" | null) => {
    // No transition will run (nothing to move, or reduced motion) → no
    // transitionend either, so finish right away.
    if (to === offset || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOffset(dir ? to : 0);
      if (dir) onCommit(dir);
      return;
    }
    committing.current = dir;
    setAnimating(true);
    setOffset(to);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (animating || (e.pointerType === "mouse" && e.button !== 0)) return;
    gesture.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, axis: null };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < LOCK_DISTANCE) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (g.axis === "x") e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (g.axis !== "x") return;
    const blocked = (dx > 0 && prev === null) || (dx < 0 && next === null);
    setOffset(blocked ? dx * EDGE_RESISTANCE : dx);
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.axis !== "x") return;
    const width = rootRef.current?.clientWidth ?? 1;
    const dx = e.clientX - g.x;
    const velocity = dx / Math.max(1, e.timeStamp - g.t);
    const far = Math.abs(dx) > width * COMMIT_RATIO || Math.abs(velocity) > COMMIT_VELOCITY;
    if (far && dx < 0 && next !== null) settle(-width, "next");
    else if (far && dx > 0 && prev !== null) settle(width, "prev");
    else settle(0, null);
  };

  const onTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget) return;
    setAnimating(false);
    if (committing.current) onCommit(committing.current);
  };

  const panel = (url: Panel, key: string, eager = false) => (
    <div key={key} className="flex h-full w-full shrink-0 items-center justify-center p-4">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={eager ? alt : ""}
          draggable={false}
          decoding={eager ? "sync" : "async"}
          className="max-w-full max-h-full object-contain rounded-lg select-none"
        />
      ) : url === undefined ? (
        <Loader2 className="h-6 w-6 animate-spin text-white/70" />
      ) : null}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="h-full overflow-hidden bg-black/90"
      style={{ touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div
        className={cn("flex h-full w-full", animating && "transition-transform ease-out")}
        style={{
          transform: `translate3d(calc(-100% + ${offset}px), 0, 0)`,
          transitionDuration: animating ? `${DURATION}ms` : undefined,
        }}
        onTransitionEnd={onTransitionEnd}
      >
        {panel(prev, "prev")}
        {panel(src, "current", true)}
        {panel(next, "next")}
      </div>
    </div>
  );
}
