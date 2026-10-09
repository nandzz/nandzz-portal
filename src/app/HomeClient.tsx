"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Check, FileText, Link2, Sparkles, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function HomeClient() {
  const { t } = useLanguage();

  const features = [
    { icon: Calendar, title: t.home.featureBookingTitle, desc: t.home.featureBookingDesc, live: true },
    { icon: FileText, title: t.home.featureContentTitle, desc: t.home.featureContentDesc, live: true },
    { icon: Link2, title: t.home.featureLinksTitle, desc: t.home.featureLinksDesc, live: true },
    { icon: Sparkles, title: t.home.featuresMore, desc: "", live: false },
  ];

  const audienceExamples = t.home.audienceExamples.split(",").map((s) => s.trim());
  const notYetExamples = t.home.audienceNotYetExamples.split(",").map((s) => s.trim());

  const steps = [
    { title: t.home.step1Title, desc: t.home.step1Desc },
    { title: t.home.step2Title, desc: t.home.step2Desc },
    { title: t.home.step3Title, desc: t.home.step3Desc },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left: Text */}
            <div>
              <div className="mb-8 flex items-center gap-3">
                <span className="h-px w-8 bg-violet-500 flex-shrink-0" />
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {t.home.badge}
                </span>
              </div>

              <h1 className="text-[clamp(3rem,8vw,5.5rem)] font-bold tracking-tight leading-[1.04]">
                {t.home.heroLine1}
                <br />
                <span className="text-violet-600">{t.home.heroLine2}</span>
              </h1>

              <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-md">
                {t.home.heroDescription}
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link href="/login?tab=signup">
                  <Button size="lg" className="px-8">
                    {t.home.getStarted}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#how">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {t.home.howItWorks}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right: Branded page mockup */}
            <div className="relative lg:ml-8">
              <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-violet-200/50 blur-3xl dark:bg-violet-800/25 pointer-events-none" />
              <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-fuchsia-200/40 blur-2xl dark:bg-fuchsia-800/20 pointer-events-none" />

              <div className="relative rounded-2xl border border-border/50 shadow-2xl shadow-black/10 overflow-hidden bg-card">
                {/* Browser chrome */}
                <div className="flex items-center gap-1.5 bg-muted/60 px-4 py-2.5 border-b border-border/40">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                  <div className="ml-3 flex-1 bg-background rounded-md h-5 flex items-center px-3 border border-border/30">
                    <span className="text-[11px] text-muted-foreground/50 font-mono">
                      nandzz.com/yourbrand
                    </span>
                  </div>
                </div>

                {/* Branded page preview */}
                <div className="p-4 bg-background/50 space-y-3">
                  {/* Profile header */}
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 w-24 rounded bg-foreground/15" />
                      <div className="h-2 w-16 rounded bg-foreground/10" />
                    </div>
                  </div>

                  {/* Booking block */}
                  <div className="rounded-lg border border-violet-200 dark:border-violet-800/60 bg-violet-50/60 dark:bg-violet-900/20 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-violet-500" />
                      <span className="text-[11px] font-medium text-violet-700 dark:text-violet-300">
                        {t.home.featureBookingTitle}
                      </span>
                    </div>
                    <span className="rounded-md bg-violet-600 px-2.5 py-1 text-[10px] font-semibold text-white">
                      {t.home.getStarted}
                    </span>
                  </div>

                  {/* Content tiles */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="aspect-video rounded-lg bg-gradient-to-br from-sky-100 to-sky-50 dark:from-sky-900/40 dark:to-sky-800/20" />
                    <div className="aspect-video rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-800/20" />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Feature suite */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight">{t.home.featuresTitle}</h2>
          <p className="mt-3 text-muted-foreground text-lg">{t.home.featuresDesc}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, desc, live }) => (
            <div
              key={title}
              className={`rounded-2xl border p-5 transition-colors ${
                live
                  ? "border-border/60 bg-card hover:border-violet-300 dark:hover:border-violet-700"
                  : "border-dashed border-border/60 bg-muted/30"
              }`}
            >
              <div
                className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${
                  live ? "bg-violet-100 dark:bg-violet-900/50" : "bg-muted"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${live ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"}`}
                />
              </div>
              <h3 className="font-semibold">{title}</h3>
              {desc && <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{desc}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for — generic, page-centered */}
      <section className="border-y border-border/50 bg-muted/20">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            {t.home.audienceTitle}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            {t.home.audienceDesc}
          </p>
          <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {t.home.audienceFitLabel}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            {audienceExamples.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium text-muted-foreground"
              >
                <Check className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                {label}
              </span>
            ))}
          </div>

          {/* Not a fit — set expectations before signup */}
          <div className="mt-12 rounded-2xl border border-dashed border-border/70 bg-background/40 px-5 py-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {t.home.audienceNotYetLabel}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {notYetExamples.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border/60 px-3.5 py-1.5 text-sm text-muted-foreground/80"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground/60" />
                  {label}
                </span>
              ))}
            </div>
            <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground leading-relaxed">
              {t.home.audienceNotYetNote}
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-7xl px-4 py-20 scroll-mt-20">
        <h2 className="mb-12 text-3xl font-bold tracking-tight text-center">
          {t.home.stepsTitle}
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="relative">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
                {i + 1}
              </div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-2xl px-4 py-20">
        <h2 className="mb-10 text-3xl font-bold tracking-tight text-center">
          {t.home.faqTitle}
        </h2>
        <div className="divide-y divide-border/50">
          {t.home.faq.map((item) => (
            <div key={item.q} className="py-6">
              <h3 className="font-semibold mb-2">{item.q}</h3>
              <p className="text-muted-foreground leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-violet-700 to-fuchsia-700 dark:from-violet-800 dark:via-violet-900 dark:to-fuchsia-900" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0_/_0.05)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0_/_0.05)_1px,transparent_1px)] bg-[size:3rem_3rem]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20">
          <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
            <div>
              <h2 className="text-3xl font-bold text-white tracking-tight">
                {t.home.ctaTitle}
              </h2>
              <p className="mt-3 text-violet-100/90 text-lg">
                {t.home.ctaDesc}
              </p>
            </div>
            <Link href="/login?tab=signup">
              <Button
                size="lg"
                className="bg-white text-violet-700 hover:bg-violet-50 whitespace-nowrap px-8 shadow-lg shadow-black/10 font-semibold"
              >
                {t.home.ctaButton}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
