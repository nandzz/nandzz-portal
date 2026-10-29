"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, Clock, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  onStart: () => void;
}

// First-run state of the booking workspace (no location yet). Explains what
// this page is for in outcome terms, then lays out the setup as three ordered
// steps with only the first actionable — the location form it opens is
// prefilled from the profile, and saving it lands the owner on Services
// (WidgetWorkspace), so the list doubles as a progress map.
export function BookingSetupGuide({ onStart }: Props) {
  const { t } = useLanguage();
  const b = t.booking;
  const steps = [
    { title: b.setupStepLocationTitle, desc: b.setupStepLocationDesc },
    { title: b.setupStepServicesTitle, desc: b.setupStepServicesDesc },
    { title: b.setupStepHoursTitle, desc: b.setupStepHoursDesc },
  ];

  return (
    <section className="rounded-2xl border border-border bg-background p-5 sm:p-8">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
        <CalendarCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-balance sm:text-2xl">{b.setupTitle}</h2>
      <p className="mt-2 max-w-xl text-sm text-pretty text-muted-foreground">{b.setupDesc}</p>

      <ol className="mt-6 space-y-0">
        {steps.map((step, i) => {
          const current = i === 0;
          return (
            <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
              {i < steps.length - 1 && (
                <span aria-hidden className="absolute left-3.5 top-8 bottom-1 w-px bg-border" />
              )}
              <span
                className={cn(
                  "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                  current ? "bg-emerald-600 text-white" : "border border-border text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <div className="pt-0.5">
                <p className={cn("text-sm font-medium", !current && "text-muted-foreground")}>{step.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button size="lg" onClick={onStart} className="h-10 w-full px-4 sm:w-auto">
          {b.setupCta} <ArrowRight className="h-4 w-4" />
        </Button>
        <span className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> {b.setupTime}
        </span>
      </div>

      <Link
        href="/guide#tour"
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <PlayCircle className="h-4 w-4" /> {b.setupTourLink}
      </Link>
    </section>
  );
}
