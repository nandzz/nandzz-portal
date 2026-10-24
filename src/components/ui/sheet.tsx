"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { cn } from "@/lib/utils";

// Below Tailwind's `sm` (40rem) owner panels switch from popover/dialog to a sheet.
const SHEET_QUERY = "(max-width: 639.98px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(SHEET_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * True below `sm`, where a surface should render as a `Sheet` instead of its
 * desktop popover/dialog. Always false on the server, so only branch on it for
 * UI that isn't part of the first paint (i.e. things that open on interaction).
 */
export function useSheetLayout() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(SHEET_QUERY).matches,
    () => false,
  );
}

// iOS-style sheet curve: fast start, long soft settle. Same curve both ways;
// exit is shorter (and scales down further on a hard flick via swipe strength).
const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";

const BACKDROP = cn(
  "fixed inset-0 z-[9999] bg-black/40",
  // Fades with the swipe (Base UI sets --drawer-swipe-progress 0→1 while dragging).
  "opacity-[calc(1_-_var(--drawer-swipe-progress))] transition-opacity duration-400",
  EASE,
  "data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-250 data-swiping:duration-0",
);

const POPUP = cn(
  "relative flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-b-0 border-border/60 bg-background shadow-2xl outline-none",
  "pb-[env(safe-area-inset-bottom)]",
  // `transform` (not Tailwind's `translate`) so Base UI's inline drag transform
  // replaces it while swiping, then the var springs it back / carries it out.
  "[transform:translateY(var(--drawer-swipe-movement-y))] duration-400",
  EASE,
  "data-ending-style:duration-[calc(var(--drawer-swipe-strength)*250ms)] data-swiping:select-none",
  "motion-safe:transition-transform motion-safe:data-starting-style:[transform:translateY(100%)] motion-safe:data-ending-style:[transform:translateY(100%)]",
  // Reduced motion: no travel, just a fade.
  "motion-reduce:transition-opacity motion-reduce:data-starting-style:opacity-0 motion-reduce:data-ending-style:opacity-0",
);

interface SheetProps {
  open: boolean;
  /**
   * Backdrop tap, Escape or swipe-down call this with `false`. Controlled: not
   * updating `open` keeps the sheet up (a swipe snaps back).
   */
  onOpenChange: (open: boolean) => void;
  /** After the exit animation, e.g. to unmount a caller that renders only while open. */
  onClosed?: () => void;
  /**
   * `dim` (default) darkens the page; `clear` leaves it untouched — for live
   * previews like the style picker — while still closing on a tap outside.
   */
  backdrop?: "dim" | "clear";
  /** Extra popup classes, e.g. a lower height cap (`max-h-*` / `h-*`). */
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /**
   * Laid out as a flex column capped at the sheet height: give the part that
   * should scroll `flex-1 overflow-y-auto` (scrollbars are hidden globally).
   */
  children: React.ReactNode;
}

/**
 * Mobile bottom sheet on Base UI's Drawer (its Dialog plus swipe handling):
 * portal, focus trap, Escape / outside-tap dismissal, scroll lock and
 * swipe-down-to-dismiss all come from Base UI; this only adds the look and the
 * enter/exit transitions (data-starting-style / data-ending-style).
 */
export function Sheet({
  open,
  onOpenChange,
  onClosed,
  backdrop = "dim",
  className,
  children,
  ...aria
}: SheetProps) {
  // Base UI only plays the enter transition on a closed→open change, so a sheet
  // mounted already open (`{show && <Sheet open />}`) opens one commit later.
  const [ready, setReady] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate post-mount flip, see above
  useEffect(() => setReady(true), []);

  return (
    <Drawer.Root
      open={open && ready}
      onOpenChange={(next) => onOpenChange(next)}
      onOpenChangeComplete={(next) => {
        if (!next) onClosed?.();
      }}
    >
      <Drawer.Portal>
        {backdrop === "dim" && <Drawer.Backdrop className={BACKDROP} />}
        <Drawer.Viewport className="fixed inset-0 z-[9999] flex items-end justify-center">
          <Drawer.Popup className={cn(POPUP, className)} {...aria}>
            <div aria-hidden="true" className="mx-auto mt-2.5 mb-1 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
            {/* Content: mouse drags here select text instead of swiping (touch still swipes). */}
            <Drawer.Content className="flex min-h-0 flex-1 flex-col">{children}</Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
