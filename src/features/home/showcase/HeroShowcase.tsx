"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import Link from "next/link";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
  type Variants,
} from "motion/react";
import { ArrowRight, BellRing, CalendarCheck, ChevronLeft, ChevronRight, Link2, Mail, Pause, Play } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SHOWCASE_COPY, toShowcaseLocale } from "./content";
import { Chips, Panel, PanelHeading, PanelText, StepList, rise } from "./panels";
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

const DRAWER = [0.32, 0.72, 0, 1] as const;

// Screens page inside the phone like an iOS push: the new one slides over, the
// old one drifts back. Direction follows navigation.
const screenSwap: Variants = {
  enter: (dir: number) => ({ transform: `translateX(${dir * 100}%)`, zIndex: 2 }),
  center: { transform: "translateX(0%)", opacity: 1, zIndex: 2, transition: { duration: 0.6, ease: DRAWER } },
  exit: (dir: number) => ({
    transform: `translateX(${dir * -28}%)`,
    opacity: 0.5,
    zIndex: 0,
    transition: { duration: 0.6, ease: DRAWER },
  }),
};

const pop = {
  initial: { opacity: 0, transform: "translateY(12px) scale(0.95)" },
  animate: { opacity: 1, transform: "translateY(0px) scale(1)" },
  exit: { opacity: 0, transform: "translateY(6px) scale(0.97)", transition: { duration: 0.2 } },
};

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

type Measured = { index: number; anchors: Record<string, Anchor>; height: number };

export function HeroShowcase({ services }: { services: { name: string; minutes: number; price: number }[] }) {
  const { t, locale } = useLanguage();
  const h = t.home;
  const copy = SHOWCASE_COPY[toShowcaseLocale(locale)];
  const reduce = useReducedMotion();

  /* ── Playback ── */
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
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
    (target: number, direction: number, atStep?: number) => {
      const next = (target + SLIDES.length) % SLIDES.length;
      const slide = SLIDES[next];
      // Reduced motion lands on the last step, so every callout is already shown.
      const s = atStep ?? (reduce ? slide.steps - 1 : 0);
      elapsed.current = s * slide.stepMs;
      progress.set(elapsed.current / slideDuration(slide));
      setDir(direction);
      setIndex(next);
      setStep(s);
    },
    [progress, reduce],
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
        goTo(index + 1, 1);
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
  const pickStep = (i: number) => {
    goTo(index, 1, i);
    setUserPaused(true);
  };

  /* ── Callout anchors, measured from the live screen ── */
  const roots = useRef<Record<number, HTMLDivElement>>({});
  const rootRefs = useMemo(
    () =>
      SLIDES.map((_, i) => (el: HTMLDivElement | null) => {
        if (el) roots.current[i] = el;
      }),
    [],
  );
  const [measured, setMeasured] = useState<Measured | null>(null);
  const slide = SLIDES[index];
  const anchorIds = ANCHORS[slide.kind];

  useLayoutEffect(() => {
    const ids = ANCHORS[SLIDES[index].kind];
    const root = roots.current[index];
    if (!ids || !root) return;
    const run = () => {
      const anchors: Record<string, Anchor> = {};
      for (const id of ids) {
        const el = root.querySelector<HTMLElement>(`[data-anchor="${id}"]`);
        if (!el) continue;
        const { x, y } = offsetWithin(el, root);
        anchors[id] = { x: Math.min(x + el.offsetWidth + 6, SCREEN.width - 22), y: y + el.offsetHeight / 2 };
      }
      setMeasured({ index, anchors, height: root.offsetHeight });
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(root);
    return () => ro.disconnect();
  }, [index]);

  const m = measured?.index === index ? measured : null;
  let scrollY = 0;
  if (anchorIds && m) {
    const a = m.anchors[anchorIds[step]];
    if (a) scrollY = Math.min(Math.max(a.y - SCREEN.height * 0.5, 0), Math.max(0, m.height - SCREEN.height));
  }
  const calloutLabels = slide.kind === "anatomy" ? copy.anatomy.items : copy.content.items;

  /* ── Input ── */
  const onPointerEnter = (e: PointerEvent) => e.pointerType === "mouse" && setHovered(true);
  const onPointerLeave = () => setHovered(false);
  const onFocus = (e: FocusEvent) => (e.target as HTMLElement).matches(":focus-visible") && setFocused(true);
  const onBlur = (e: FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") goTo(index + 1, 1);
    else if (e.key === "ArrowLeft") goTo(index - 1, -1);
    else return;
    e.preventDefault();
  };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const swipe = Math.abs(info.offset.x) > 60 || Math.abs(info.velocity.x) > 400;
    if (!swipe) return;
    if (info.offset.x < 0) goTo(index + 1, 1);
    else goTo(index - 1, -1);
  };

  const mock = copy.mock;
  const screen = (i: number) => {
    const props: ScreenProps = { step: i === index ? step : 0, scrollY: i === index ? scrollY : 0, rootRef: rootRefs[i], mock };
    switch (SLIDES[i].kind) {
      case "hero":
        return <HeroScreen {...props} services={services} />;
      case "anatomy":
        return <AnatomyScreen {...props} />;
      case "content":
        return <ContentScreen {...props} />;
      case "booking":
        return <BookingScreen {...props} locale={locale} />;
      case "style":
        return <StyleScreen {...props} />;
      case "links":
        return <LinksScreen {...props} />;
      case "gallery":
        return <GalleryScreen {...props} />;
    }
  };

  const names = copy.controls.names;
  const slideOf = (i: number) =>
    copy.controls.slideOf.replace("{n}", String(i + 1)).replace("{total}", String(SLIDES.length));
  const muted = "text-[color-mix(in_oklab,var(--clay-ink)_60%,transparent)]";

  return (
    <MotionConfig reducedMotion="user">
      <section
        ref={sectionRef}
        aria-roledescription="carousel"
        aria-label={copy.controls.region}
        className="relative overflow-hidden"
      >
        <div
          className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-14 pb-20 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-24"
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onFocus={onFocus}
          onBlur={onBlur}
        >
          {/* ── Text: one panel per slide, stacked in a single grid cell ── */}
          <div className="max-w-2xl">
            <div className="grid [grid-template-areas:'stack']">
              <Panel active={index === 0} label={`${names[0]}, ${slideOf(0)}`}>
                <motion.h1
                  variants={rise}
                  className="text-[clamp(2.6rem,5.6vw,4.4rem)] leading-[1.02] font-bold tracking-[-0.035em]"
                >
                  {h.heroLine1}
                  <br />
                  <Highlighted text={h.heroLine2} />
                </motion.h1>
                <PanelText>{h.heroDescription}</PanelText>
              </Panel>

              <Panel active={index === 1} label={`${names[1]}, ${slideOf(1)}`}>
                <PanelHeading eyebrow={copy.anatomy.eyebrow} title={copy.anatomy.title} />
                <StepList items={copy.anatomy.items} step={index === 1 ? step : -1} onPick={pickStep} />
              </Panel>

              <Panel active={index === 2} label={`${names[2]}, ${slideOf(2)}`}>
                <PanelHeading eyebrow={copy.content.eyebrow} title={copy.content.title} />
                <StepList items={copy.content.items} step={index === 2 ? step : -1} onPick={pickStep} />
              </Panel>

              <Panel active={index === 3} label={`${names[3]}, ${slideOf(3)}`}>
                <PanelHeading eyebrow={copy.booking.eyebrow} title={copy.booking.title} />
                <StepList items={copy.booking.steps} step={index === 3 ? step : -1} onPick={pickStep} />
                <div className="hidden sm:block">
                  <Chips title={copy.booking.businessTitle} items={copy.booking.business} />
                </div>
              </Panel>

              <Panel active={index === 4} label={`${names[4]}, ${slideOf(4)}`}>
                <PanelHeading eyebrow={copy.style.eyebrow} title={copy.style.title} />
                <StepList items={copy.style.items} step={index === 4 ? step : -1} onPick={pickStep} />
              </Panel>

              <Panel active={index === 5} label={`${names[5]}, ${slideOf(5)}`}>
                <PanelHeading eyebrow={copy.links.eyebrow} title={copy.links.title} />
                <PanelText>{copy.links.desc}</PanelText>
              </Panel>

              <Panel active={index === 6} label={`${names[6]}, ${slideOf(6)}`}>
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

          {/* ── Phone stage ── */}
          <div className="flex flex-col items-center">
            <div className="showcase-stage relative" data-annotated={slide.annotated || undefined}>
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-16 rounded-full blur-3xl"
                style={{ background: "radial-gradient(closest-side, var(--clay-glow), transparent)" }}
              />
              <div className="showcase-phone relative" aria-hidden>
                <motion.div
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.16}
                  dragSnapToOrigin
                  onDragEnd={onDragEnd}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <PhoneFrame>
                    <AnimatePresence initial={false} custom={dir}>
                      <motion.div
                        key={index}
                        custom={dir}
                        variants={screenSwap}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="absolute inset-0"
                      >
                        {screen(index)}
                      </motion.div>
                    </AnimatePresence>
                  </PhoneFrame>
                </motion.div>

                {/* Annotations + floating cards live outside the screen's clip */}
                <div className="pointer-events-none absolute inset-0">
                  <AnimatePresence>
                    {anchorIds && m && (
                      <motion.div
                        key={index}
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: 0.45, duration: 0.3 } }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      >
                        {anchorIds.slice(0, step + 1).map((id, i) =>
                          m.anchors[id] ? (
                            <Callout
                              key={id}
                              anchor={m.anchors[id]}
                              scrollY={scrollY}
                              label={calloutLabels[i].label}
                              active={i === step}
                            />
                          ) : null,
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {slide.kind === "hero" && (
                      <motion.div key="hero-cards" className="absolute inset-0" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                        <motion.div
                          {...pop}
                          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.35 }}
                          className="clay absolute top-[7%] -left-6 flex items-center gap-3 rounded-2xl py-2.5 pr-4 pl-2.5 sm:-left-24"
                        >
                          <span className="clay-violet flex h-9 w-9 items-center justify-center rounded-xl">
                            <CalendarCheck className="h-4.5 w-4.5" />
                          </span>
                          <span className="leading-tight">
                            <span className="block text-[13px] font-semibold">{h.mockToastTitle}</span>
                            <span className={`block text-xs ${muted}`}>{h.mockToastBody}</span>
                          </span>
                        </motion.div>
                        <motion.div
                          {...pop}
                          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.55 }}
                          className="clay absolute -right-6 bottom-[10%] flex items-center gap-2.5 rounded-full py-2 pr-4 pl-2 sm:-right-20"
                        >
                          <span className="clay-well flex h-8 w-8 items-center justify-center rounded-full">
                            <Link2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                          </span>
                          <span className="leading-tight">
                            <span className={`block text-[11px] ${muted}`}>{h.mockLinkLabel}</span>
                            <span className="block text-[13px] font-semibold">nandzz.com/yourbrand</span>
                          </span>
                        </motion.div>
                      </motion.div>
                    )}

                    {slide.kind === "booking" && step === 4 && (
                      <motion.div key="booking-toasts" className="absolute inset-0" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                        {copy.booking.toasts.map((toast, i) => {
                          const Icon = [CalendarCheck, Mail, BellRing][i];
                          const place = [
                            "top-[9%] -left-6 sm:-left-28",
                            "top-[34%] -right-6 sm:-right-28",
                            "top-[56%] -left-6 sm:-left-24",
                          ][i];
                          return (
                            <motion.div
                              key={toast.label}
                              {...pop}
                              transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.5 + i * 0.25 }}
                              className={`clay absolute z-10 flex items-center gap-2.5 rounded-2xl py-2 pr-3.5 pl-2 ${place}`}
                            >
                              <span className={`${i === 0 ? "clay-violet" : "clay-well text-violet-600 dark:text-violet-400"} flex h-8 w-8 items-center justify-center rounded-xl`}>
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
            </div>

            {/* ── Controls ── */}
            <div className="mt-8 flex items-center gap-2" role="group" aria-label={copy.controls.region} onKeyDown={onKeyDown}>
              <button
                type="button"
                onClick={() => goTo(index - 1, -1)}
                aria-label={copy.controls.prev}
                className="clay hidden h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95 sm:flex"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <div className="flex w-[13.5rem] gap-1.5">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i, i >= index ? 1 : -1)}
                    aria-label={`${names[i]}, ${slideOf(i)}`}
                    aria-current={i === index ? "true" : undefined}
                    className="flex-1 py-3"
                  >
                    <span className="clay-well block h-1.5 overflow-hidden rounded-full">
                      <motion.span
                        className="block h-full origin-left rounded-full bg-violet-600 dark:bg-violet-400"
                        style={{ transform: i === index ? fill : i < index ? "scaleX(1)" : "scaleX(0)" }}
                      />
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => goTo(index + 1, 1)}
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
              {names[index]}, {slideOf(index)}
            </p>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
