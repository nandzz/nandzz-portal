"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { CalendarCheck, CalendarDays, LayoutGrid, Link2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { EASE_OUT, useReduceMotion } from "../showcase/phone";
import { muted, reveal } from "./reveal";

// The handle in step 1's copy ("nandzz.com/yourbrand"), so the mock URL is in
// the visitor's language.
function handleOf(desc: string) {
  return desc.match(/nandzz\.com\/([\p{L}\p{N}_-]+)/u)?.[1] ?? "yourbrand";
}

/* ───────────────────────── Step visuals ───────────────────────── */

// Step 1: the link being claimed, its handle wiping in like it's typed.
function ClaimVisual({ label, handle, reduce }: { label: string; handle: string; reduce: boolean }) {
  return (
    <div className="w-full">
      <p className={`px-1 text-xs font-medium ${muted}`}>{label}</p>
      <div className="clay mt-2 flex items-center gap-2 rounded-2xl px-3.5 py-3 text-sm">
        <Link2 className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
        <span className="flex min-w-0 items-center">
          <span className={muted}>nandzz.com/</span>
          <motion.span
            className="truncate font-semibold text-violet-600 dark:text-violet-400"
            // Always ends unclipped: the server renders it clipped before reduced
            // motion is known, so reduced motion snaps the wipe and fades instead.
            initial={{ opacity: 0, clipPath: "inset(0 100% 0 0)" }}
            whileInView={{ opacity: 1, clipPath: "inset(0 0% 0 0)" }}
            viewport={{ once: true, amount: 0.6 }}
            transition={
              reduce
                ? { opacity: { duration: 0.4, delay: 0.45 }, clipPath: { duration: 0 } }
                : { opacity: { duration: 0 }, clipPath: { duration: 0.7, ease: "linear", delay: 0.45 } }
            }
          >
            {handle}
          </motion.span>
          <span className="ml-px h-4 w-0.5 shrink-0 rounded-full bg-violet-500/80" />
        </span>
      </div>
    </div>
  );
}

// Step 2: the blocks of a page, switched on for what fits (booking + content
// here; links left off).
const BLOCKS = [
  { Icon: CalendarDays, on: true },
  { Icon: LayoutGrid, on: true },
  { Icon: Link2, on: false },
];

function BlocksVisual({ reduce }: { reduce: boolean }) {
  return (
    <div className="grid w-full grid-cols-3 gap-2.5">
      {BLOCKS.map(({ Icon, on }, i) => (
        <div key={i} className="clay flex flex-col items-center gap-3 rounded-2xl px-2 py-3.5">
          <Icon className={`h-5 w-5 ${on ? "text-violet-600 dark:text-violet-400" : muted}`} />
          {/* Toggle: the knob slides over and the track fills, one by one */}
          <span className="relative h-5 w-9 overflow-hidden rounded-full bg-(--clay-ink)/12">
            {on && (
              <motion.span
                className="absolute inset-0 rounded-full bg-violet-600"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.25, delay: 0.5 + i * 0.18 }}
              />
            )}
            <motion.span
              className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
              initial={{ transform: "translateX(0px)" }}
              whileInView={{ transform: on ? "translateX(16px)" : "translateX(0px)" }}
              viewport={{ once: true }}
              transition={{ duration: reduce ? 0 : 0.35, ease: EASE_OUT, delay: 0.5 + i * 0.18 }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

// Step 3: a booking landing, over the faint edge of the one before it.
function BookedVisual({ title, body, reduce }: { title: string; body: string; reduce: boolean }) {
  return (
    <div className="relative w-full pt-2.5">
      <div aria-hidden className="clay absolute inset-x-4 top-0 h-10 rounded-2xl opacity-60" />
      <motion.div
        className="clay relative flex items-center gap-3 rounded-2xl px-3.5 py-3"
        {...reveal(reduce, 0.5, "translateY(-10px) scale(0.97)", "translateY(0px) scale(1)")}
        viewport={{ once: true, amount: 0.6 }}
      >
        <span className="clay-violet flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <CalendarCheck className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold">{title}</span>
          <span className={`block truncate text-xs ${muted}`}>{body}</span>
        </span>
      </motion.div>
    </div>
  );
}

/* ───────────────────────── Section ───────────────────────── */

// How it works: three numbered steps on a track. Phones read it as a vertical
// timeline (badge + rail on the left); lg lays it out as a row, the rail running
// from badge to badge.
export function HowSection() {
  const { t } = useLanguage();
  const h = t.home;
  const reduce = useReduceMotion();

  const steps: { title: string; desc: string; visual: ReactNode }[] = [
    {
      title: h.step1Title,
      desc: h.step1Desc,
      visual: <ClaimVisual label={h.mockLinkLabel} handle={handleOf(h.step1Desc)} reduce={reduce} />,
    },
    { title: h.step2Title, desc: h.step2Desc, visual: <BlocksVisual reduce={reduce} /> },
    {
      title: h.step3Title,
      desc: h.step3Desc,
      visual: <BookedVisual title={h.mockToastTitle} body={h.mockToastBody} reduce={reduce} />,
    },
  ];

  // The rail draws from the badge toward the next step: down on phones,
  // across on lg (two elements, one per axis). It always ends at full scale
  // (the server renders it at 0); reduced motion snaps it and fades instead.
  const rail = (axis: "X" | "Y", delay: number) => ({
    initial: { opacity: reduce ? 0 : 1, transform: `scale${axis}(0)` },
    whileInView: { opacity: 1, transform: `scale${axis}(1)` },
    viewport: { once: true, amount: 0.5 },
    transition: reduce
      ? { opacity: { duration: 0.4, delay }, transform: { duration: 0 } }
      : { duration: 0.6, ease: EASE_OUT, delay },
  });

  return (
    <section id="how" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-16 sm:pb-24">
      <motion.h2
        className="mb-8 text-center text-3xl font-bold tracking-[-0.025em] sm:mb-12 sm:text-4xl"
        {...reveal(reduce)}
      >
        {h.stepsTitle}
      </motion.h2>

      <ol className="mx-auto grid max-w-xl lg:max-w-none lg:grid-cols-3 lg:gap-6">
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <li key={i} className="flex gap-4 lg:flex-col lg:gap-5">
              {/* Track: badge, then the rail to the next step */}
              <div className="flex flex-col items-center lg:flex-row" aria-hidden>
                <motion.span
                  className="clay-violet flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-bold"
                  {...reveal(reduce, i * 0.12, "scale(0.9)", "scale(1)")}
                >
                  {i + 1}
                </motion.span>
                {!last && (
                  <>
                    <motion.span
                      className="my-2 w-0.5 flex-1 origin-top rounded-full bg-violet-500/30 lg:hidden"
                      {...rail("Y", 0.2 + i * 0.12)}
                    />
                    <motion.span
                      className="hidden h-0.5 flex-1 origin-left rounded-full bg-violet-500/30 lg:ml-3 lg:-mr-3 lg:block"
                      {...rail("X", 0.2 + i * 0.12)}
                    />
                  </>
                )}
              </div>

              <motion.article
                className={`clay flex min-w-0 flex-1 flex-col rounded-[2rem] p-5 sm:p-8 ${last ? "" : "mb-5 lg:mb-0"}`}
                {...reveal(reduce, 0.08 + i * 0.12)}
              >
                <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className={`mt-2 leading-relaxed ${muted}`}>{step.desc}</p>
                <div className="clay-well mt-6 flex min-h-[7.5rem] flex-1 items-center rounded-3xl p-3 sm:p-4" aria-hidden>
                  {step.visual}
                </div>
              </motion.article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
