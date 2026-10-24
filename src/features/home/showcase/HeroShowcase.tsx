"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { ArrowRight, BellRing, CalendarCheck, ChevronLeft, ChevronRight, Link2, Mail } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SHOWCASE_COPY, toShowcaseLocale, type ShowcaseCopy } from "./content";
import { Chips, Panel, PanelHeading, PanelText, SLIDE_S, StepList, slideFade, slideMove, type SlidePos } from "./panels";
import { Callout, EASE_OUT, PhoneFrame, still, useReduceMotion, type Anchor } from "./phone";
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
import { ANCHORS, PHONE, SCREEN, SLIDES, slideDuration } from "./slides";

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
const popFade = { initial: still(pop.initial, true), animate: still(pop.animate, true), exit: still(pop.exit, true) };

const muted = "text-[color-mix(in_oklab,var(--clay-ink)_60%,transparent)]";

// The line under the phone on small screens, where the slide's text panel
// gives way to it: [lead in bold, rest].
function captionOf(copy: ShowcaseCopy, n: number, step: number): [string, string] {
  const item = (items: { label: string; desc: string }[]): [string, string] => [items[step].label, items[step].desc];
  switch (SLIDES[n].kind) {
    case "hero":
      return ["", copy.heroCaption];
    case "anatomy":
      return item(copy.anatomy.items);
    case "content":
      return item(copy.content.items);
    case "booking":
      return item(copy.booking.steps);
    case "style":
      return item(copy.style.items);
    case "links":
      return [copy.controls.names[n], copy.links.title];
    case "gallery":
      return [copy.controls.names[n], copy.gallery.title];
  }
}

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
  from,
  step,
  visit,
  copy,
  locale,
  heroCards,
}: {
  i: number;
  pos: SlidePos;
  from: SlidePos;
  step: number;
  visit: number;
  copy: ShowcaseCopy;
  locale: string;
  heroCards: { toastTitle: string; toastBody: string; linkLabel: string };
}) {
  const slide = SLIDES[i];
  const active = pos === 0;
  const reduce = useReduceMotion();
  const cardFx = reduce ? popFade : pop;
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
      custom={from}
      variants={reduce ? slideFade : slideMove}
      inert={!active}
    >
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
              <AnimatePresence>
                {anchorIds.slice(0, step + 1).map((id, n) =>
                  measured.anchors[id] ? (
                    <motion.div key={id} className="absolute inset-0" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                      <Callout
                        anchor={measured.anchors[id]}
                        scrollY={scrollY}
                        label={calloutLabels[n].label}
                        active={n === step}
                        delay={n === step && n > 0 && !reduce ? 0.7 : 0}
                      />
                    </motion.div>
                  ) : null,
                )}
              </AnimatePresence>
            </motion.div>
          )}

          <AnimatePresence>
            {slide.kind === "hero" && active && (
              <motion.div key="hero-cards" className="absolute inset-0" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                <motion.div
                  {...cardFx}
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
                  {...cardFx}
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
                      {...cardFx}
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

type Track = {
  index: number;
  step: number;
  pos: SlidePos[]; // where each slide sits or is heading
  from: SlidePos; // side the current slide jumped to before entering (0 = none)
  held: number[]; // the step each slide keeps showing while it's away
  visits: number[];
};

const START: Track = {
  index: 0,
  step: 0,
  pos: SLIDES.map((_, n) => (n === 0 ? 0 : 1)),
  from: 0,
  held: SLIDES.map((s) => s.steps - 1),
  visits: SLIDES.map(() => 0),
};

export function HeroShowcase() {
  const { t, locale } = useLanguage();
  const h = t.home;
  const copy = SHOWCASE_COPY[toShowcaseLocale(locale)];
  const reduce = useReduceMotion();

  /* ── Playback ── */
  const [track, setTrack] = useState(START);
  const { index, step } = track;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const [announced, setAnnounced] = useState("");
  const stopped = userPaused ?? reduce; // reduced motion: no autoplay until asked
  const paused = stopped || hovered || focused || offscreen;

  const elapsed = useRef(0);
  // The slide that just left, so coming straight back resumes it instead of restarting.
  const left = useRef<{ slide: number; elapsed: number; at: number } | null>(null);
  const progress = useMotionValue(0);
  const fill = useTransform(progress, (p) => `scaleX(${p})`);

  const names = copy.controls.names;
  const slideOf = (n: number) =>
    copy.controls.slideOf.replace("{n}", String(n + 1)).replace("{total}", String(SLIDES.length));
  const label = (n: number) => `${names[n]}, ${slideOf(n)}`;

  // `dir` is the way the carousel moves: 1 = forward (enters from the right).
  // `user` marks a change the visitor asked for, which screen readers announce.
  const goTo = (target: number, dir: 1 | -1, user = false) => {
    const next = (target + SLIDES.length) % SLIDES.length;
    if (next === index) return;
    const slide = SLIDES[next];
    const now = performance.now();
    const back = left.current?.slide === next && now - left.current.at < SLIDE_S * 1000;
    const resumeAt = back ? left.current!.elapsed : null;
    left.current = { slide: index, elapsed: elapsed.current, at: now };
    // Reduced motion lands on the last step, so every callout is already shown.
    const s = back ? track.held[next] : reduce ? slide.steps - 1 : 0;
    elapsed.current = resumeAt ?? s * slide.stepMs;
    progress.set(elapsed.current / slideDuration(slide));
    setTrack({
      index: next,
      step: s,
      pos: track.pos.map((p, n) => (n === next ? 0 : n === index ? (-dir as SlidePos) : p)),
      from: track.pos[next] === dir ? 0 : dir,
      held: track.held.map((held, n) => (n === index ? step : held)),
      visits: back ? track.visits : track.visits.map((v, n) => (n === next ? v + 1 : v)),
    });
    // Autoplay runs until the visitor takes over: any navigation of theirs stops it for good.
    if (user) {
      setAnnounced(label(next));
      setUserPaused(true);
    }
  };
  const goToRef = useRef(goTo);
  const moveRef = useRef((dir: 1 | -1) => goTo(index + dir, dir, true));
  useLayoutEffect(() => {
    goToRef.current = goTo;
    moveRef.current = (dir) => goTo(index + dir, dir, true);
  });

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
        goToRef.current(index + 1, 1);
        return;
      }
      progress.set(elapsed.current / total);
      const s = Math.min(slide.steps - 1, Math.floor(elapsed.current / slide.stepMs));
      // A frame can land after a click already moved to another slide: its step
      // belongs to this one, so drop it.
      setTrack((t) => (t.index !== index || t.step === s ? t : { ...t, step: s }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, index, progress]);

  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Trackpad: a horizontal two-finger swipe moves one slide. Native and
  // non-passive so it can also keep the browser's swipe-back gesture out.
  const swipeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = swipeRef.current;
    if (!el) return;
    let travel = 0;
    let moved = false;
    let idle = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // vertical: the page scrolls
      e.preventDefault();
      // One gesture (momentum included) moves one slide; it ends after a short lull.
      clearTimeout(idle);
      idle = window.setTimeout(() => {
        travel = 0;
        moved = false;
      }, 180);
      if (moved) return;
      travel += e.deltaX;
      if (Math.abs(travel) < 50) return;
      moved = true;
      moveRef.current(travel > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(idle);
    };
  }, []);

  // Picking a guide item jumps there and holds, so it reads like a manual.
  const pickStep = (n: number) => {
    elapsed.current = n * SLIDES[index].stepMs;
    progress.set(elapsed.current / slideDuration(SLIDES[index]));
    setTrack((t) => ({ ...t, step: n }));
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
    if (e.key === "ArrowRight") goTo(index + 1, 1, true);
    else if (e.key === "ArrowLeft") goTo(index - 1, -1, true);
    else return;
    e.preventDefault();
  };
  const onPanEnd = (e: globalThis.PointerEvent, info: PanInfo) => {
    if (e.pointerType === "mouse") return; // swipes are for touch; a mouse drag is text selection
    if (Math.abs(info.offset.x) < Math.abs(info.offset.y)) return; // vertical scroll, not a swipe
    if (Math.abs(info.offset.x) < 50 && Math.abs(info.velocity.x) < 400) return;
    if (info.offset.x < 0) goTo(index + 1, 1, true);
    else goTo(index - 1, -1, true);
  };

  // Side by side at every width: on mobile each grows from its label width (long
  // locales may wrap), natural width from sm up. Under the text from lg up, under
  // the carousel below it. `className` carries the display (`flex` / `hidden`),
  // so the two never sit on one element unordered.
  const ctas = (className: string) => (
    <div className={`items-stretch gap-2.5 sm:flex-wrap sm:items-center sm:gap-3 ${className}`}>
      <Link
        href="/login?tab=signup"
        className="clay-violet inline-flex min-h-12 flex-auto items-center justify-center gap-2 rounded-full px-4 py-2 text-center text-sm font-semibold leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 sm:h-12 sm:flex-none sm:px-7 sm:py-0 sm:text-[15px]"
      >
        {h.getStarted}
        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
      </Link>
      <Link
        href="#how"
        className="clay inline-flex min-h-12 flex-auto items-center justify-center rounded-full px-4 py-2 text-center text-sm font-medium leading-tight transition-transform [@media(hover:hover)]:hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 sm:h-12 sm:flex-none sm:px-6 sm:py-0 sm:text-[15px]"
      >
        {h.howItWorks}
      </Link>
    </div>
  );
  const [captionLead, captionText] = captionOf(copy, index, step);

  const posOf = (n: number) => track.pos[n];
  const fromOf = (n: number): SlidePos => (n === index ? track.from : 0);
  const stepOf = (n: number) => (n === index ? step : track.held[n]);

  return (
    <MotionConfig reducedMotion="user">
      {/* From lg up the hero fills the viewport under the navbar (h-16 + border) and centers its content in it */}
      <section
        ref={sectionRef}
        aria-roledescription="carousel"
        aria-label={copy.controls.region}
        className="relative overflow-hidden overscroll-x-contain lg:flex lg:min-h-[calc(100svh-4rem-1px)] lg:items-center"
      >
        <motion.div
          ref={swipeRef}
          className="mx-auto grid w-full max-w-7xl items-center gap-x-10 gap-y-8 px-4 pt-8 pb-16 sm:pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-y-6 lg:py-10"
          style={{ touchAction: "pan-y" }}
          onPanEnd={onPanEnd}
          onFocus={onFocus}
          onBlur={onBlur}
        >
          {/* ── Text: one panel per slide in a single grid cell; the buttons below stay put ── */}
          <div className="max-w-2xl">
            <h1 className="sr-only">
              {h.heroLine1} {h.heroLine2.replace(/\*/g, "")}
            </h1>
            {/* Below lg: a fixed headline, and the slide text becomes the caption under
                the phone, so what the visitor reads sits next to what it describes.
                The panels stay for screen readers. */}
            <p aria-hidden className="text-[clamp(2.25rem,9vw,3.25rem)] leading-[1.04] font-bold tracking-[-0.035em] lg:hidden">
              {h.heroLine1}
              <br />
              <Highlighted text={h.heroLine2} />
            </p>
            <div className="grid [grid-template-areas:'stack'] max-lg:sr-only">
              <Panel pos={posOf(0)} from={fromOf(0)} label={label(0)}>
                {/* The visible headline leaves with slide 1; the h1 for assistive tech and crawlers stays put (below). */}
                <p aria-hidden className="text-[clamp(2.6rem,5.6vw,4.4rem)] leading-[1.02] font-bold tracking-[-0.035em]">
                  {h.heroLine1}
                  <br />
                  <Highlighted text={h.heroLine2} />
                </p>
                <PanelText>{h.heroDescription}</PanelText>
              </Panel>

              <Panel pos={posOf(1)} from={fromOf(1)} label={label(1)}>
                <PanelHeading eyebrow={copy.anatomy.eyebrow} title={copy.anatomy.title} />
                <StepList items={copy.anatomy.items} step={index === 1 ? step : -1} onPick={pickStep} />
              </Panel>

              <Panel pos={posOf(2)} from={fromOf(2)} label={label(2)}>
                <PanelHeading eyebrow={copy.content.eyebrow} title={copy.content.title} />
                <StepList items={copy.content.items} step={index === 2 ? step : -1} onPick={pickStep} />
              </Panel>

              <Panel pos={posOf(3)} from={fromOf(3)} label={label(3)}>
                <PanelHeading eyebrow={copy.booking.eyebrow} title={copy.booking.title} />
                <StepList items={copy.booking.steps} step={index === 3 ? step : -1} onPick={pickStep} />
                <div className="showcase-chips hidden sm:block">
                  <Chips title={copy.booking.businessTitle} items={copy.booking.business} />
                </div>
              </Panel>

              <Panel pos={posOf(4)} from={fromOf(4)} label={label(4)}>
                <PanelHeading eyebrow={copy.style.eyebrow} title={copy.style.title} />
                <StepList items={copy.style.items} step={index === 4 ? step : -1} onPick={pickStep} />
              </Panel>

              <Panel pos={posOf(5)} from={fromOf(5)} label={label(5)}>
                <PanelHeading eyebrow={copy.links.eyebrow} title={copy.links.title} />
                <PanelText>{copy.links.desc}</PanelText>
              </Panel>

              <Panel pos={posOf(6)} from={fromOf(6)} label={label(6)}>
                <PanelHeading eyebrow={copy.gallery.eyebrow} title={copy.gallery.title} />
                <PanelText>{copy.gallery.desc}</PanelText>
              </Panel>
            </div>

            {ctas("mt-9 hidden lg:flex")}
          </div>

          {/* ── Phones: one per slide, moving in lockstep with their text ── */}
          <div className="flex flex-col items-center">
            {/* Scaled to fit the viewport height (see .showcase-fit) */}
            <div className="showcase-fit" style={{ "--phone-h": `${PHONE.height}px` } as CSSProperties}>
              {/* Hovering the phone (not the whole hero) holds the slide */}
              <div
                className="relative grid [grid-template-areas:'stack']"
                aria-hidden
                onPointerEnter={onPointerEnter}
                onPointerLeave={onPointerLeave}
              >
                {/* One soft glow behind the stack, instead of a blurred one per phone */}
                <div
                  className="pointer-events-none absolute -inset-16 rounded-full"
                  style={{ background: "radial-gradient(closest-side, var(--clay-glow), transparent)" }}
                />
                {SLIDES.map((_, n) => (
                  <PhoneStage
                    key={n}
                    i={n}
                    pos={posOf(n)}
                    from={fromOf(n)}
                    step={stepOf(n)}
                    visit={track.visits[n]}
                    copy={copy}
                    locale={locale}
                    heroCards={{ toastTitle: h.mockToastTitle, toastBody: h.mockToastBody, linkLabel: h.mockLinkLabel }}
                  />
                ))}
              </div>
            </div>

            {/* Small screens: the current step in one line (two at most), right under the phone */}
            <div aria-hidden className="mt-5 grid h-10 w-full max-w-sm [grid-template-areas:'cap'] lg:hidden">
              <AnimatePresence initial={false}>
                <motion.p
                  key={`${index}-${step}`}
                  className="line-clamp-2 self-center text-center text-sm leading-snug [grid-area:cap]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.3, delay: 0.15 } }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                >
                  {captionLead && <span className="font-semibold">{captionLead} · </span>}
                  <span className={muted}>{captionText}</span>
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* ── Controls: centered under both columns. Dots, with the current slide
              as a pill that fills while autoplay runs (full once it's stopped) ── */}
          <div
            className="-mt-5 flex items-center justify-center gap-3 lg:col-span-2 lg:mt-0"
            role="group"
            aria-label={copy.controls.region}
            onKeyDown={onKeyDown}
          >
            <button
              type="button"
              onClick={() => goTo(index - 1, -1, true)}
              aria-label={copy.controls.prev}
              className="clay hidden h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95 sm:flex"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <div className="flex items-center">
              {SLIDES.map((_, n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => goTo(n, n > index ? 1 : -1, true)}
                  aria-label={label(n)}
                  aria-current={n === index ? "true" : undefined}
                  className="group flex h-9 items-center px-1.5"
                >
                  <span
                    className={`clay-well block h-2 overflow-hidden rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                      n === index ? "w-9" : "w-2"
                    }`}
                  >
                    <motion.span
                      className="block h-full origin-left rounded-full bg-violet-600 dark:bg-violet-400"
                      style={{ transform: n !== index ? "scaleX(0)" : stopped ? "scaleX(1)" : fill }}
                    />
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => goTo(index + 1, 1, true)}
              aria-label={copy.controls.next}
              className="clay hidden h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95 sm:flex"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
            {/* Only changes the visitor makes are announced; autoplay stays quiet */}
            <p className="sr-only" aria-live="polite">
              {announced}
            </p>
          </div>

          {ctas("flex lg:hidden")}
        </motion.div>
      </section>
    </MotionConfig>
  );
}
