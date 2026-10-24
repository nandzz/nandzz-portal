"use client";

import type { ReactNode } from "react";
import { motion, type Variants } from "motion/react";
import { Check } from "lucide-react";

export type SlidePos = -1 | 0 | 1; // before / current / after the active slide

// Text and phone of a slide move as one block: both sides park a full viewport
// away and glide in on the same curve, so they read as a single carousel slide.
export const slideMove: Variants = {
  "-1": { transform: "translateX(-100vw)", opacity: 0, transition: { duration: 0.75, ease: [0.32, 0.72, 0, 1] } },
  "0": { transform: "translateX(0vw)", opacity: 1, transition: { duration: 0.75, ease: [0.32, 0.72, 0, 1] } },
  "1": { transform: "translateX(100vw)", opacity: 0, transition: { duration: 0.75, ease: [0.32, 0.72, 0, 1] } },
};

// Every slide's text lives in the same grid cell, so the column keeps the height
// of the tallest one and the static buttons below never jump.
export function Panel({ pos, label, children }: { pos: SlidePos; label: string; children: ReactNode }) {
  const active = pos === 0;
  return (
    <motion.div
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      aria-hidden={!active}
      inert={!active}
      className={`[grid-area:stack] self-center ${active ? "" : "pointer-events-none"}`}
      initial={false}
      animate={String(pos)}
      variants={slideMove}
    >
      {children}
    </motion.div>
  );
}

const muted = "text-[color-mix(in_oklab,var(--clay-ink)_64%,transparent)]";

export function PanelHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">{eyebrow}</p>
      <h2
        className="mt-3 text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.05] font-bold tracking-[-0.03em] text-balance"
      >
        {title}
      </h2>
    </>
  );
}

// The guide list: follows the phone step by step, and picking an item jumps to it.
export function StepList({
  items,
  step,
  onPick,
}: {
  items: { label: string; desc: string }[];
  step: number;
  onPick: (i: number) => void;
}) {
  return (
    <ol className="mt-7 space-y-0.5">
      {items.map((item, i) => {
        const current = i === step;
        return (
          <li key={item.label}>
            <button
              type="button"
              onClick={() => onPick(i)}
              aria-current={current ? "step" : undefined}
              className={`group flex w-full items-start gap-3.5 rounded-2xl px-3 py-2.5 text-left transition-[opacity,background-color] duration-300 ${
                current ? "clay" : "opacity-55 [@media(hover:hover)]:hover:opacity-85"
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums transition-colors duration-300 ${
                  current ? "clay-violet" : "clay-well"
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold leading-snug">{item.label}</span>
                {/* Only the current step shows its line, so the list stays short at 5+ items */}
                <span
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ${
                    current ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <span className={`overflow-hidden text-sm leading-snug ${muted}`}>{item.desc}</span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function PanelText({ children }: { children: ReactNode }) {
  return (
    <p className={`mt-5 max-w-[32rem] text-lg leading-relaxed ${muted}`}>
      {children}
    </p>
  );
}

export function Chips({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-6">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {items.map((label) => (
          <span key={label} className="clay inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium">
            <Check className="h-3 w-3 text-violet-600 dark:text-violet-400" strokeWidth={3} aria-hidden />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
