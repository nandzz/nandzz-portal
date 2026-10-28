"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { EASE_OUT, StepList, useReduceMotion } from "@/features/home";
import { cn } from "@/lib/utils";
import type { GuideCopy, GuideTourChapterId } from "../content";
import { BrowserFrame } from "./BrowserFrame";
import { TOUR_CHAPTERS } from "./chapters";

const STEP_MS = 5000;
const muted = "text-[color-mix(in_oklab,var(--clay-ink)_62%,transparent)]";

// True only on the client. The screens build their fake data off today's date,
// so they render after hydration (the frame holds their place until then).
const noop = () => () => {};
function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

// The back-office tour: a chapter switch (Dashboard / Booking / Contents),
// the chapter's steps beside a browser window showing the real dashboard
// components on sample data. It plays on its own while in view, chapter after
// chapter, until the visitor picks a step or a chapter themselves.
export function GuideTour({ copy }: { copy: GuideCopy["tour"] }) {
  const { locale } = useLanguage();
  const reduce = useReduceMotion();
  const mounted = useMounted();
  const rootRef = useRef<HTMLElement>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [userDriven, setUserDriven] = useState(false);

  const chapter = TOUR_CHAPTERS[chapterIndex];
  const chapterCopy = copy.chapters[chapter.id];
  const playing = inView && !hovered && !userDriven && !reduce;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => {
      if (step < chapterCopy.steps.length - 1) {
        setStep(step + 1);
      } else {
        setChapterIndex((chapterIndex + 1) % TOUR_CHAPTERS.length);
        setStep(0);
      }
    }, STEP_MS);
    return () => window.clearTimeout(id);
  }, [playing, step, chapterIndex, chapterCopy.steps.length]);

  const pickChapter = (id: GuideTourChapterId) => {
    setUserDriven(true);
    setChapterIndex(TOUR_CHAPTERS.findIndex((c) => c.id === id));
    setStep(0);
  };
  const pickStep = (i: number) => {
    setUserDriven(true);
    setStep(i);
  };

  const Screen = chapter.Screen;

  return (
    <section
      id="tour"
      ref={rootRef}
      className="mt-24 scroll-mt-24 sm:mt-32"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <header className="max-w-2xl">
        <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{copy.title}</h2>
        <p className={cn("mt-4 text-lg text-pretty", muted)}>{copy.subtitle}</p>
      </header>

      <div role="tablist" aria-label={copy.chaptersLabel} className="clay-well mt-10 inline-flex gap-1 rounded-full p-1">
        {TOUR_CHAPTERS.map((c, i) => {
          const active = i === chapterIndex;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => pickChapter(c.id)}
              className={cn(
                "relative overflow-hidden rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                active ? "clay" : cn(muted, "[@media(hover:hover)]:hover:text-[var(--clay-ink)]"),
              )}
            >
              {copy.chapters[c.id].tab}
              {/* Time left on this step while it plays */}
              {active && playing && (
                <motion.span
                  key={`${chapterIndex}-${step}`}
                  aria-hidden
                  className="absolute inset-x-3 bottom-1 h-0.5 origin-left rounded-full bg-violet-500/60"
                  initial={{ transform: "scaleX(0)" }}
                  animate={{ transform: "scaleX(1)" }}
                  transition={{ duration: STEP_MS / 1000, ease: "linear" }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12 xl:gap-16">
        <div role="tabpanel" aria-label={chapterCopy.tab}>
          <h3 className="text-2xl font-semibold tracking-tight">{chapterCopy.title}</h3>
          <p className={cn("mt-3 leading-relaxed", muted)}>{chapterCopy.body}</p>
          <StepList items={chapterCopy.steps} step={step} onPick={pickStep} focusable />
        </div>

        <BrowserFrame path={chapter.path(step)}>
          <AnimatePresence mode="wait" initial={false}>
            {mounted && (
              <motion.div
                // Remount on a language switch: screens seed their sample data once
                key={`${chapter.id}-${locale}`}
                className="absolute inset-0"
                initial={{ opacity: 0, transform: reduce ? "none" : "translateY(8px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
              >
                <Screen step={step} />
              </motion.div>
            )}
          </AnimatePresence>
        </BrowserFrame>
      </div>
    </section>
  );
}
