"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { motion } from "motion/react";
import { PHONE, SCREEN } from "./slides";

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduce(onChange: () => void) {
  const mql = window.matchMedia(REDUCE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

// The OS reduced-motion setting. False on the server and during hydration (so
// both render the same markup), then the real value right after.
export function useReduceMotion() {
  return useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE_QUERY).matches, () => false);
}

// Reduced motion keeps a target's fade and drops its movement.
export function still<T extends object>(target: T, reduce: boolean): T {
  if (!reduce || !("transform" in target)) return target;
  const rest = { ...target } as Record<string, unknown>;
  delete rest.transform;
  return rest as T;
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative rounded-[46px] bg-[#0e0c12] shadow-[0_40px_60px_-24px_rgb(58_38_112_/_0.45),0_0_0_1px_rgb(255_255_255_/_0.06)_inset] dark:shadow-[0_40px_70px_-24px_rgb(0_0_0_/_0.8),0_0_0_1px_rgb(255_255_255_/_0.08)_inset]"
      style={{ width: PHONE.width, height: PHONE.height, padding: PHONE.bezel }}
    >
      <div
        className="showcase-screen relative isolate overflow-hidden rounded-[38px] bg-(--s-bg)"
        style={{ width: SCREEN.width, height: SCREEN.height }}
      >
        {children}
        {/* Dynamic island stays above every screen */}
        <span className="absolute top-2.5 left-1/2 z-30 h-[22px] w-[76px] -translate-x-1/2 rounded-full bg-black" />
      </div>
    </div>
  );
}

// iOS-style status bar, painted in the screen's own text color.
export function StatusBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-[42px] items-center justify-between px-6 pt-0.5 text-[11px] font-semibold text-(--s-text)">
      <span className="tabular-nums">9:41</span>
      <span className="flex items-center gap-1" aria-hidden>
        <span className="flex items-end gap-[1.5px]">
          {[4, 6, 8, 10].map((h) => (
            <span key={h} className="w-[2.5px] rounded-[1px] bg-current" style={{ height: h }} />
          ))}
        </span>
        <span className="ml-1 h-[10px] w-[20px] rounded-[3px] border border-current/40 p-[1.5px]">
          <span className="block h-full w-3/4 rounded-[1.5px] bg-current" />
        </span>
      </span>
    </div>
  );
}

// Seconds from a TapRing's delay to the moment it lands (its peak), when the
// tapped thing should react.
export const TAP_LAND = 0.75 * 0.35;

// A finger tap: a ring that pops and fades on the element being chosen.
// Reduced motion skips it; the selection still changes.
export function TapRing({ className = "", delay = 0.55 }: { className?: string; delay?: number }) {
  const reduce = useReduceMotion();
  if (reduce) return null;
  return (
    <span className={`pointer-events-none absolute z-10 ${className}`} aria-hidden>
      <motion.span
        className="block h-9 w-9 rounded-full border-2 border-white/90 bg-white/35 shadow-[0_2px_10px_rgb(0_0_0_/_0.25)]"
        initial={{ opacity: 0, transform: "scale(0.6)" }}
        animate={{ opacity: [0, 0.95, 0], transform: ["scale(0.6)", "scale(1)", "scale(1.3)"] }}
        transition={{ delay, duration: 0.75, times: [0, 0.35, 1], ease: EASE_OUT }}
      />
    </span>
  );
}

export type Anchor = { x: number; y: number };

// Figma-style annotation: a dot on the element, a hairline out past the phone,
// and a label. Positions are in phone-frame pixels; `top` tracks the screen's
// scroll through a transform transition so dot and element move together.
// `delay` holds a new callout back until the screen has scrolled to its element.
export function Callout({
  anchor,
  scrollY,
  label,
  active,
  delay = 0,
}: {
  anchor: Anchor;
  scrollY: number;
  label: string;
  active: boolean;
  delay?: number;
}) {
  const reduce = useReduceMotion();
  const y = PHONE.bezel + anchor.y - scrollY;
  const visible = y > 40 && y < PHONE.height - 20;
  return (
    <div
      className="showcase-callout pointer-events-none absolute top-0 flex items-center"
      style={{
        left: PHONE.bezel + anchor.x,
        transform: `translateY(${y}px) translateY(-50%)`,
        opacity: visible ? 1 : 0,
      }}
    >
      <motion.span
        className={`relative z-10 h-2.5 w-2.5 shrink-0 rounded-full ring-4 transition-colors duration-300 ${
          active ? "bg-violet-600 ring-violet-500/25" : "bg-(--clay-ink)/50 ring-(--clay-ink)/10"
        }`}
        initial={still({ opacity: 0, transform: "scale(0.6)" }, reduce)}
        animate={still({ opacity: 1, transform: "scale(1)" }, reduce)}
        transition={{ duration: 0.3, ease: EASE_OUT, delay }}
      />
      <motion.span
        className={`h-px min-w-3 flex-1 origin-left transition-colors duration-300 ${
          active ? "bg-violet-500" : "bg-(--clay-ink)/30"
        }`}
        initial={reduce ? { opacity: 0 } : { transform: "scaleX(0)" }}
        animate={reduce ? { opacity: 1 } : { transform: "scaleX(1)" }}
        transition={{ duration: 0.4, ease: EASE_OUT, delay: delay + 0.08 }}
      />
      <motion.span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-300 ${
          active ? "clay-violet" : "clay text-(--clay-ink)/75"
        }`}
        initial={still({ opacity: 0, transform: "translateX(-6px)" }, reduce)}
        animate={still({ opacity: 1, transform: "translateX(0px)" }, reduce)}
        transition={{ duration: 0.35, ease: EASE_OUT, delay: delay + 0.22 }}
      >
        {label}
      </motion.span>
    </div>
  );
}
