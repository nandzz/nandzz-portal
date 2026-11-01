"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import { Check, ChevronRight, Clock, Eye, PlayCircle, Share2, Tag, UserCog, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { WidgetTab } from "@/features/booking/widgetTabs";
import { ShareBookingLinkModal, type ShareUrls } from "./ShareBookingLinkModal";

type StepId = "services" | "hours" | "staff" | "page" | "share";

type Step = {
  id: StepId;
  title: string;
  desc: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
} & ({ tab: WidgetTab } | { href: string } | { share: true });

type Stored = { done: StepId[]; hidden: boolean };

interface Props {
  instanceId: string;
  // Public page path (`/<username>`), where the owner edits photos, bio, colors.
  pagePath: string;
  shareUrls?: ShareUrls;
  onGoToTab: (tab: WidgetTab) => void;
}

// Shown on the Today tab to an owner who recently claimed a demo page (the
// server decides who; see the booking page). The demo was built with example
// services, prices and hours, so the checklist leads them through making it
// theirs, each step opening the real place to do it. A step counts as done once
// opened; progress and "hide" live in localStorage, per calendar.
export function ClaimWelcomeGuide({ instanceId, pagePath, shareUrls, onGoToTab }: Props) {
  const { t } = useLanguage();
  const c = t.claimWelcome;
  const storageKey = `widget:${instanceId}:claimGuide`;
  const [state, setState] = useState<Stored | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    // Read after mount (no localStorage during SSR); render nothing until
    // then so a hidden guide never flashes.
    let stored: Stored = { done: [], hidden: false };
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) stored = { ...stored, ...JSON.parse(raw) };
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(stored);
  }, [storageKey]);

  const save = (next: Stored) => {
    setState(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };

  if (!state || state.hidden) return null;

  const steps: Step[] = [
    { id: "services", title: c.servicesTitle, desc: c.servicesDesc, Icon: Tag, tab: "services" },
    { id: "hours", title: c.hoursTitle, desc: c.hoursDesc, Icon: Clock, tab: "availability" },
    { id: "staff", title: c.staffTitle, desc: c.staffDesc, Icon: UserCog, tab: "staff" },
    { id: "page", title: c.pageTitle, desc: c.pageDesc, Icon: Eye, href: pagePath },
    ...(shareUrls ? [{ id: "share", title: c.shareTitle, desc: c.shareDesc, Icon: Share2, share: true } as Step] : []),
  ];
  const doneCount = steps.filter((s) => state.done.includes(s.id)).length;
  const allDone = doneCount === steps.length;

  const markDone = (id: StepId) => {
    if (!state.done.includes(id)) save({ ...state, done: [...state.done, id] });
  };
  const hide = () => save({ ...state, hidden: true });

  return (
    <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none sm:p-6 dark:border-emerald-900/50 dark:bg-emerald-950/15">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            {c.badge}
          </span>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-balance">
            {allDone ? c.doneTitle : c.title}
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{allDone ? c.doneDesc : c.desc}</p>
        </div>
        <button
          type="button"
          onClick={hide}
          aria-label={c.hide}
          title={c.hide}
          className="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-emerald-100 hover:text-foreground dark:hover:bg-emerald-900/40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <div
            className="h-full origin-left rounded-full bg-emerald-600 transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${doneCount / steps.length})` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {c.progress.replace("{done}", String(doneCount)).replace("{total}", String(steps.length))}
        </span>
      </div>

      {!allDone && (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
          {steps.map((step) => {
            const done = state.done.includes(step.id);
            const rowClass =
              "flex w-full items-center gap-3 px-3 py-3 text-left transition-[background-color,transform] duration-150 ease-out hover:bg-muted/60 active:scale-[0.99] sm:px-4";
            const body = (
              <>
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
                    done
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : <step.Icon className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-medium", done && "text-muted-foreground line-through")}>
                    {step.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">{step.desc}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </>
            );
            return (
              <li key={step.id}>
                {"href" in step ? (
                  <Link href={step.href} onClick={() => markDone(step.id)} className={rowClass}>
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={rowClass}
                    onClick={() => {
                      markDone(step.id);
                      if ("tab" in step) onGoToTab(step.tab);
                      else setShareOpen(true);
                    }}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/guide#tour"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <PlayCircle className="h-4 w-4" /> {c.tourLink}
        </Link>
        {allDone && (
          <button
            type="button"
            onClick={hide}
            className="text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-300"
          >
            {c.hide}
          </button>
        )}
      </div>

      {shareUrls && shareOpen && <ShareBookingLinkModal urls={shareUrls} onClose={() => setShareOpen(false)} />}
    </section>
  );
}
