"use client";

import { motion } from "motion/react";
import {
  BedDouble,
  Briefcase,
  CalendarCheck,
  Package,
  Palette,
  Scissors,
  Sparkles,
  SprayCan,
  Stethoscope,
  Store,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useReduceMotion } from "../showcase/phone";
import { muted, reveal } from "./reveal";

// Icons follow the order of the comma lists in `home.audienceExamples`
// (salons, barbers, cleaners, studios, clinics, freelancers) and
// `home.audienceNotYetExamples` (restaurants, stays, group events, equipment
// hire), which every locale keeps.
const FIT_ICONS: LucideIcon[] = [Sparkles, Scissors, SprayCan, Palette, Stethoscope, Briefcase];
const NOT_FOR_ICONS: LucideIcon[] = [UtensilsCrossed, BedDouble, Users, Package];

const list = (s: string) => s.split(",").map((part) => part.trim()).filter(Boolean);

// Who it's for: the appointment businesses Nandzz fits, raised, and the ones it
// isn't built for, quiet underneath.
export function AudienceSection() {
  const { t } = useLanguage();
  const h = t.home;
  const reduce = useReduceMotion();
  const fit = list(h.audienceExamples);
  const notFor = list(h.audienceNotYetExamples);

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:pb-24">
      <div className="grid gap-8 sm:gap-12 lg:grid-cols-12 lg:items-center">
        <motion.div className="max-w-xl lg:col-span-5" {...reveal(reduce)}>
          <h2 className="text-3xl font-bold tracking-[-0.025em] sm:text-4xl">{h.audienceTitle}</h2>
          <p className="mt-4 text-lg leading-relaxed text-[color-mix(in_oklab,var(--clay-ink)_65%,transparent)]">
            {h.audienceDesc}
          </p>
        </motion.div>

        <div className="lg:col-span-7">
          <motion.div className="clay rounded-[2rem] p-5 sm:p-8" {...reveal(reduce, 0.05)}>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CalendarCheck className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
              {h.audienceFitLabel}
            </p>
            <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
              {fit.map((label, i) => {
                const Icon = FIT_ICONS[i] ?? Store;
                return (
                  <motion.li
                    key={label}
                    className="clay-well flex items-center gap-3 rounded-2xl p-2.5 sm:p-3"
                    {...reveal(reduce, 0.12 + i * 0.04, "translateY(8px)")}
                  >
                    <span className="clay flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-violet-600 dark:text-violet-400">
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <span className="min-w-0 text-sm leading-tight font-medium">{label}</span>
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>

          {/* Not built for: plain and flat, no "coming soon" */}
          <motion.div className="mt-6 px-1 sm:px-2" {...reveal(reduce, 0.2)}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-1 text-sm font-semibold">{h.audienceNotYetLabel}</p>
              {notFor.map((label, i) => {
                const Icon = NOT_FOR_ICONS[i] ?? Store;
                return (
                  <span
                    key={label}
                    className={`inline-flex items-center gap-1.5 rounded-full border border-(--clay-ink)/10 px-3 py-1 text-sm ${muted}`}
                  >
                    <Icon className="h-3.5 w-3.5 opacity-70" aria-hidden />
                    {label}
                  </span>
                );
              })}
            </div>
            <p className={`mt-3 max-w-xl text-sm leading-relaxed ${muted}`}>{h.audienceNotYetNote}</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
