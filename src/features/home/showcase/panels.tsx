"use client";

import type { ReactNode } from "react";
import { motion, type Variants } from "motion/react";
import { Check } from "lucide-react";
import { EASE_OUT } from "./phone";

// Every slide's text lives in the same grid cell, so the column keeps the height
// of the tallest one and nothing below it jumps when slides change.
const panel: Variants = {
  in: { transition: { staggerChildren: 0.05, delayChildren: 0.12 } },
  out: {},
};
export const rise: Variants = {
  in: { opacity: 1, transform: "translateY(0px)", transition: { duration: 0.45, ease: EASE_OUT } },
  out: { opacity: 0, transform: "translateY(10px)", transition: { duration: 0.2, ease: EASE_OUT } },
};

export function Panel({ active, label, children }: { active: boolean; label: string; children: ReactNode }) {
  return (
    <motion.div
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      aria-hidden={!active}
      inert={!active}
      className={`[grid-area:stack] self-center ${active ? "" : "pointer-events-none"}`}
      initial={false}
      animate={active ? "in" : "out"}
      variants={panel}
    >
      {children}
    </motion.div>
  );
}

const muted = "text-[color-mix(in_oklab,var(--clay-ink)_64%,transparent)]";

export function PanelHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <motion.p variants={rise} className="text-sm font-semibold text-violet-600 dark:text-violet-400">
        {eyebrow}
      </motion.p>
      <motion.h2
        variants={rise}
        className="mt-3 text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.05] font-bold tracking-[-0.03em] text-balance"
      >
        {title}
      </motion.h2>
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
    <motion.ol variants={rise} className="mt-7 space-y-0.5">
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
    </motion.ol>
  );
}

export function PanelText({ children }: { children: ReactNode }) {
  return (
    <motion.p variants={rise} className={`mt-5 max-w-[32rem] text-lg leading-relaxed ${muted}`}>
      {children}
    </motion.p>
  );
}

export function Chips({ title, items }: { title: string; items: string[] }) {
  return (
    <motion.div variants={rise} className="mt-6">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {items.map((label) => (
          <span key={label} className="clay inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium">
            <Check className="h-3 w-3 text-violet-600 dark:text-violet-400" strokeWidth={3} aria-hidden />
            {label}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
