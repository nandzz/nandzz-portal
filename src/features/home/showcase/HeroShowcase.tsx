"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { ArrowRight, BellRing, CalendarCheck, ChevronLeft, ChevronRight, Link2, Mail, Pause, Play } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SHOWCASE_COPY, toShowcaseLocale, type ShowcaseCopy } from "./content";
import { Chips, Panel, PanelHeading, PanelText, StepList, slideMove, type SlidePos } from "./panels";
import { Callout, EASE_OUT, PhoneFrame, type Anchor } from "./phone";
import {
  AnatomyScreen,
  BookingScreen,
  ContentScreen,
  GalleryScreen,
  HeroScreen,
  LinksScreen,
  StyleScreen,
  type ScreenProps,
} from "./screens";
import { ANCHORS, SCREEN, SLIDES, slideDuration } from "./slides";

// Renders "*word*" segments of a translated line in the brand violet.
function Highlighted({ text }: { text: string }) {
  return text.split(/\*([^*]+)\*/).map((part, i) =>
    i % 2 ? (
      <span key={i} className="text-violet-600 dark:text-violet-400">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

const pop = {
  initial: { opacity: 0, transform: "translateY(12px) scale(0.95)" },
  animate: { opacity: 1, transform: "translateY(0px) scale(1)" },
  exit: { opacity: 0, transform: "translateY(6px) scale(0.97)", transition: { duration: 0.2 } },
};

const muted = "text-[color-mix(in_oklab,var(--clay-ink)_60%,transparent)]";

// Layout offset of `el` inside `root`, ignoring transforms (so it's stable while
// the screen is mid-scroll or mid-slide).
function offsetWithin(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

/* ───────────────────────── One slide's phone ───────────────────────── */

function PhoneStage({
  i,
  pos,
  step,
  visit,
  copy,
  locale,
  heroCards,
}: {
  i: number;
  pos: SlidePos;
  step: number;
  visit: number;
  copy: ShowcaseCopy;
  locale: string;
  heroCards: { toastTitle: string; toastBody: string; linkLabel: string };
}) {
  const slide = SLIDES[i];
  const active = pos === 0;
  const anchorIds = ANCHORS[slide.kind];
  const rootRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{ anchors: Record<string, Anchor>; height: number } | null>(null);

  // Callout anchors, measured from the live screen (re-run when it remounts).
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!anchorIds || !root) return;
    const run = () => {
      const anchors: Record<string, Anchor> = {};
      for (const id of anchorIds) {
        const el = root.querySelector<HTMLElement>(`[data-anchor="${id}"]`);
        if (!el) continue;
        const { x, y } = offsetWithin(el, root);
        anchors[id] = { x: Math.min(x + el.offsetWidth + 6, SCREEN.width - 22), y: y + el.offsetHeight / 2 };
      }
      setMeasured({ anchors, height: root.offsetHeight });
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(root);
    return () => ro.disconnect();
  }, [anchorIds, visit]);

  let scrollY = 0;
  if (anchorIds && measured) {
    const a = measured.anchors[anchorIds[step]];
    if (a) scrollY = Math.min(Math.max(a.y - SCREEN.height * 0.5, 0), Math.max(0, measured.height - SCREEN.height));
  }
  const calloutLabels = slide.kind === "anatomy" ? copy.anatomy.items : copy.content.items;

  const props: ScreenProps = { step, scrollY, rootRef, mock: copy.mock };
  // Keyed by visit: each time the slide comes back its screen starts fresh
  // (sheets slide up again, taps replay).
  const screen = (() => {
    switch (slide.kind) {
      case "hero":
        return <HeroScreen key={visit} {...props} />;
      case "anatomy":
        return <AnatomyScreen key={visit} {...props} />;
      case "content":
        return <ContentScreen key={visit} {...props} />;
      case "booking":
        return <BookingScreen key={visit} {...props} locale={locale} />;
      case "style":
        return <StyleScreen key={visit} {...props} />;
      case "links":
        return <LinksScreen key={visit} {...props} />;
      case "gallery":
        return <GalleryScreen key={visit} {...props} />;
    }
  })();

  return (
    <motion.div
      className="showcase-stage relative [grid-area:stack] justify-self-center"
      data-annotated={slide.annotated || undefined}
      initial={false}
      animate={String(pos)}
      variants={slideMove}
      inert={!active}
    >
      <div
        className="pointer-events-none absolute -inset-16 rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, var(--clay-glow), transparent)" }}
      />
      <div className="showcase-phone relative">
        <PhoneFrame>{screen}</PhoneFrame>

        {/* Annotations + floating cards live outside the screen's clip */}
        <div className="pointer-events-none absolute inset-0">
          {anchorIds && measured && (
            <motion.div
              key={visit}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.6, duration: 0.3 } }}
            >
              {anchorIds.slice(0, step + 1).map((id, n) =>
                measured.anchors[id] ? (
                  <Callout key={id} anchor={measured.anchors[id]} scrollY={scrollY} label={calloutLabels[n].label} active={n === step} />
                ) : null,
              )}
            </motion.div>
          )}

          <AnimatePresence>
            {slide.kind === "hero" && active && (
              <motion.div key="hero-cards" className="absolute inset-0" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                <motion.div
                  {...pop}
                  transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.45 }}
                  className="clay absolute top-[7%] -left-6 flex items-center gap-3 rounded-2xl py-2.5 pr-4 pl-2.5 sm:-left-24"
                >
                  <span className="clay-violet flex h-9 w-9 items-center justify-center rounded-xl">
                    <CalendarCheck className="h-4.5 w-4.5" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[13px] font-semibold">{heroCards.toastTitle}</span>
                    <span className={`block text-xs ${muted}`}>{heroCards.toastBody}</span>
                  </span>
                </motion.div>
                <motion.div
                  {...pop}
                  transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.65 }}
                  className="clay absolute -right-6 bottom-[10%] flex items-center gap-2.5 rounded-full py-2 pr-4 pl-2 sm:-right-20"
                >
                  <span className="clay-well flex h-8 w-8 items-center justify-center rounded-full">
                    <Link2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </span>
                  <span className="leading-tight">
                    <span className={`block text-[11px] ${muted}`}>{heroCards.linkLabel}</span>
                    <span className="block text-[13px] font-semibold">nandzz.com/yourbrand</span>
                  </span>
                </motion.div>
              </motion.div>
            )}

            {slide.kind === "booking" && active && step === slide.steps - 1 && (
              <motion.div key="booking-toasts" className="absolute inset-0" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                {copy.booking.toasts.map((toast, n) => {
                  const Icon = [CalendarCheck, Mail, BellRing][n];
                  const place = ["top-[9%] -left-6 sm:-left-28", "top-[34%] -right-6 sm:-right-28", "top-[56%] -left-6 sm:-left-24"][n];
                  return (
                    <motion.div
                      key={toast.label}
                      {...pop}
                      transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.5 + n * 0.25 }}
                      className={`clay absolute z-10 flex items-center gap-2.5 rounded-2xl py-2 pr-3.5 pl-2 ${place}`}
                    >
                      <span
                        className={`${n === 0 ? "clay-violet" : "clay-well text-violet-600 dark:text-violet-400"} flex h-8 w-8 items-center justify-center rounded-xl`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="leading-tight">
                        <span className="block text-[12px] font-semibold">{toast.label}</span>
                        <span className={`block text-[11px] ${muted}`}>{toast.desc}</span>
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

/* ───────────────────────── The carousel ───────────────────────── */

export function HeroShowcase() {
  const { t, locale } = useLanguage();
  const h = t.home;
  const copy = SHOWCASE_COPY[toShowcaseLocale(locale)];
  const reduce = useReducedMotion();

  /* ── Playback ── */
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [visits, setVisits] = useState(() => SLIDES.map(() => 0));
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const stopped = userPaused ?? !!reduce; // reduced motion: no autoplay until asked
  const paused = stopped || hovered || focused || offscreen;

  const elapsed = useRef(0);
  const progress = useMotionValue(0);
  const fill = useTransform(progress, (p) => `scaleX(${p})`);

  const goTo = useCallback(
    (target: number, atStep?: number) => {
      const next = (target + SLIDES.length) % SLIDES.length;
      const slide = SLIDES[next];
      // Reduced motion lands on the last step, so every callout is already shown.
      const s = atStep ?? (reduce ? slide.steps - 1 : 0);
      elapsed.current = s * slide.stepMs;
      progress.set(elapsed.current / slideDuration(slide));
      if (next !== index) setVisits((v) => v.map((n, k) => (k === next ? n + 1 : n)));
      setIndex(next);
      setStep(s);
    },
    [index, progress, reduce],
  );

  useEffect(() => {
    if (paused) return;
    const slide = SLIDES[index];
    const total = slideDuration(slide);
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      elapsed.current += Math.min(now - last, 64);
      last = now;
      if (elapsed.current >= total) {
        goTo(index + 1);
        return;
      }
      progress.set(elapsed.current / total);
      setStep(Math.min(slide.steps - 1, Math.floor(elapsed.current / slide.stepMs)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, index, goTo, progress]);

  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Picking a guide item jumps there and holds, so it reads like a manual.
  const pickStep = (n: number) => {
    goTo(index, n);
    setUserPaused(true);
  };

  /* ── Input ── */
  const onPointerEnter = (e: PointerEvent) => e.pointerType === "mouse" && setHovered(true);
  const onPointerLeave = () => setHovered(false);
  const onFocus = (e: FocusEvent) => (e.target as HTMLElement).matches(":focus-visible") && setFocused(true);
  const onBlur = (e: FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") goTo(index + 1);
    else if (e.key === "ArrowLeft") goTo(index - 1);
    else return;
    e.preventDefault();
  };
  const onPanEnd = (e: globalThis.PointerEvent, info: PanInfo) => {
    if (e.pointerType === "mouse") return; // swipes are for touch; a mouse drag is text selection
    if (Math.abs(info.offset.x) < Math.abs(info.offset.y)) return; // vertical scroll, not a swipe
    if (Math.abs(info.offset.x) < 50 && Math.abs(info.velocity.x) < 400) return;
    goTo(info.offset.x < 0 ? index + 1 : index - 1);
  };

  const names = copy.controls.names;
  const slideOf = (n: number) =>
    copy.controls.slideOf.replace("{n}", String(n + 1)).replace("{total}", String(SLIDES.length));
  const posOf = (n: number): SlidePos => (n < index ? -1 : n > index ? 1 : 0);
  const stepOf = (n: number) => (n === index ? step : SLIDES[n].steps - 1);
  const label = (n: number) => `${names[n]}, ${slideOf(n)}`;

  return (
    <MotionConfig reducedMotion="user">
      <section
        ref={sectionRef}
        aria-roledescription="carousel"
        aria-label={copy.controls.region}
        className="relative overflow-hidden"
      >
        <motion.div
          className="mx-auto grid max-w-7xl items-center gap-x-10 gap-y-12 px-4 pt-14 pb-20 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:pb-24"
          style={{ touchAction: "pan-y" }}
          onPanEnd={onPanEnd}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onFocus={onFocus}
          onBlur={onBlur}
        >
          {/* ── Text: one panel per slide in a single grid cell; the buttons below stay put ── */}
          <div className="max-w-2xl">
            <div className="grid [grid-template-areas:'stack']">
              <Panel pos={posOf(0)} label={label(0)}>
                <h1 className="text-[clamp(2.6rem,5.6vw,4.4rem)] leading-[1.02] font-bold tracking-[-0.035em]">
                  {h.heroLine1}
                  <br />
                  <Highlighted text={h.heroLine2} />
                </h1>
                <PanelText>{h.heroDescription}</PanelText>
              </Panel>

              <Panel pos={posOf(1)} label={label(1)}>
                <PanelHeading eyebrow={copy.anatomy.eyebrow} title={copy.anatomy.title} />
                <StepList items={copy.anatomy.items} step={index === 1 ? step : -1} onPick={pickStep} />
              </Panel>

              <Panel pos={posOf(2)} label={label(2)}>
                <PanelHeading eyebrow={copy.content.eyebrow} title={copy.content.title} />
                <StepList items={copy.content.items} step={index === 2 ? step : -1} onPick={pickStep} />
              </Panel>

              <Panel pos={posOf(3)} label={label(3)}>
                <PanelHeading eyebrow={copy.booking.eyebrow} title={copy.booking.title} />
                <StepList items={copy.booking.steps} step={index === 3 ? step : -1} onPick={pickStep} />
                <div className="hidden sm:block">
                  <Chips title={copy.booking.businessTitle} items={copy.booking.business} />
                </div>
              </Panel>

              <Panel pos={posOf(4)} label={label(4)}>
                <PanelHeading eyebrow={copy.style.eyebrow} title={copy.style.title} />
                <StepList items={copy.style.items} step={index === 4 ? step : -1} onPick={pickStep} />
              </Panel>

              <Panel pos={posOf(5)} label={label(5)}>
                <PanelHeading eyebrow={copy.links.eyebrow} title={copy.links.title} />
                <PanelText>{copy.links.desc}</PanelText>
              </Panel>

              <Panel pos={posOf(6)} label={label(6)}>
                <PanelHeading eyebrow={copy.gallery.eyebrow} title={copy.gallery.title} />
                <PanelText>{copy.gallery.desc}</PanelText>
              </Panel>
            </div>

            {/* Side by side at every width: on mobile each grows from its label width (long locales may wrap), natural width from sm up */}
            <div className="mt-9 flex items-stretch gap-2.5 sm:flex-wrap sm:items-center sm:gap-3">
              <Link
                href="/login?tab=signup"
                className="clay-violet inline-flex min-h-12 flex-auto items-center justify-center gap-2 rounded-full px-4 py-2 text-center text-sm font-semibold leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 sm:h-12 sm:flex-none sm:px-7 sm:py-0 sm:text-[15px]"
              >
                {h.getStarted}
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </Link>
              <Link
                href="#how"
                className="clay inline-flex min-h-12 flex-auto items-center justify-center rounded-full px-4 py-2 text-center text-sm font-medium leading-tight transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 sm:h-12 sm:flex-none sm:px-6 sm:py-0 sm:text-[15px]"
              >
                {h.howItWorks}
              </Link>
            </div>
          </div>

          {/* ── Phones: one per slide, moving in lockstep with their text ── */}
          <div className="flex flex-col items-center">
            <div className="grid [grid-template-areas:'stack']" aria-hidden>
              {SLIDES.map((_, n) => (
                <PhoneStage
                  key={n}
                  i={n}
                  pos={posOf(n)}
                  step={stepOf(n)}
                  visit={visits[n]}
                  copy={copy}
                  locale={locale}
                  heroCards={{ toastTitle: h.mockToastTitle, toastBody: h.mockToastBody, linkLabel: h.mockLinkLabel }}
                />
              ))}
            </div>

            {/* ── Controls (static) ── */}
            <div className="mt-8 flex items-center gap-2" role="group" aria-label={copy.controls.region} onKeyDown={onKeyDown}>
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                aria-label={copy.controls.prev}
                className="clay hidden h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95 sm:flex"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <div className="flex w-[13.5rem] gap-1.5">
                {SLIDES.map((_, n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => goTo(n)}
                    aria-label={label(n)}
                    aria-current={n === index ? "true" : undefined}
                    className="flex-1 py-3"
                  >
                    <span className="clay-well block h-1.5 overflow-hidden rounded-full">
                      <motion.span
                        className="block h-full origin-left rounded-full bg-violet-600 dark:bg-violet-400"
                        style={{ transform: n === index ? fill : n < index ? "scaleX(1)" : "scaleX(0)" }}
                      />
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                aria-label={copy.controls.next}
                className="clay hidden h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95 sm:flex"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setUserPaused(!stopped)}
                aria-label={stopped ? copy.controls.play : copy.controls.pause}
                className="clay flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95"
              >
                {stopped ? <Play className="h-3.5 w-3.5" aria-hidden /> : <Pause className="h-3.5 w-3.5" aria-hidden />}
              </button>
            </div>
            <p className="sr-only" aria-live={stopped ? "polite" : "off"}>
              {label(index)}
            </p>
          </div>
        </motion.div>
      </section>
    </MotionConfig>
  );
}
