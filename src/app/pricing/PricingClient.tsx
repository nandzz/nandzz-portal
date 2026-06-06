"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Zap, HelpCircle, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const FREE_SPACES_LIMIT = 5;

const FREE_FEATURES = [
  `${FREE_SPACES_LIMIT} Spaces`,
  "Public spaces",
  "Community profile page",
  "Collections",
  "Like & save spaces",
  "Browse & Explore feed",
];

const PRO_FEATURES = [
  { text: "Unlimited Spaces", pro: true },
  { text: "Private spaces", pro: true },
  { text: "Pro badge on profile", pro: true },
  { text: "Priority placement in Explore", pro: true },
  { text: "HTML editor (GrapesJS)", pro: true },
  { text: "Analytics dashboard (coming soon)", pro: false },
  { text: "Everything in Free", pro: false },
];

const FAQS = [
  {
    q: "Can I try Pro for free?",
    a: `The Free plan lets you explore all core features with up to ${FREE_SPACES_LIMIT} Spaces. No credit card required to get started.`,
  },
  {
    q: `What happens when I hit the ${FREE_SPACES_LIMIT}-space limit?`,
    a: "You can view and manage your existing Spaces, but you won't be able to create new ones until you upgrade to Pro or delete an existing Space.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel your Pro subscription at any time — you'll keep Pro features until the end of your billing period, with no extra charges.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Yes! Annual billing saves you 27%, equivalent to getting 2 months completely free.",
  },
  {
    q: "Is my payment information secure?",
    a: "Payments are processed by Stripe, a PCI-compliant payment processor. We never store your card details.",
  },
];

export function PricingClient() {
  const [annual, setAnnual] = useState(false);
  const { t } = useLanguage();

  const proMonthly = 9;
  const proAnnual = 79;
  const displayPrice = annual ? proAnnual : proMonthly;
  const billingLabel = annual ? t.pricing.perYear : t.pricing.perMonth;
  const monthlyEquiv = (proAnnual / 12).toFixed(2);

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 -translate-x-1/2 top-0 h-[500px] w-[700px] rounded-full bg-violet-100/40 blur-3xl dark:bg-violet-950/20" />
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200/60 bg-violet-50/80 px-4 py-1.5 dark:border-violet-800/60 dark:bg-violet-950/40">
          <Zap className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
            {t.pricing.badge}
          </span>
        </div>

        <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-bold tracking-tight leading-[1.1]">
          {t.pricing.heroLine1}{" "}
          <span className="text-violet-600">{t.pricing.heroLine2}</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-md mx-auto">
          {t.pricing.heroDesc}
        </p>

        {/* Billing toggle */}
        <div className="mt-10 inline-flex items-center gap-1 rounded-full bg-muted/60 p-1 border border-border/50">
          <button
            onClick={() => setAnnual(false)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
              !annual
                ? "bg-background shadow-sm text-foreground border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.pricing.monthly}
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all ${
              annual
                ? "bg-background shadow-sm text-foreground border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.pricing.annual}
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:bg-green-900/50 dark:text-green-400">
              {t.pricing.save27}
            </span>
          </button>
        </div>
      </section>

      {/* Plan cards */}
      <section className="mx-auto max-w-4xl px-4 pb-20">
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">

          {/* Free */}
          <div className="rounded-2xl border border-border/60 bg-card p-8 flex flex-col">
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground mb-3">
                {t.pricing.freeTier}
              </div>
              <p className="text-sm text-muted-foreground">
                {t.pricing.freeTagline}
              </p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">$0</span>
                <span className="text-muted-foreground text-sm">{t.pricing.perMonth}</span>
              </div>
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Check className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>

            <Link href="/login?tab=signup">
              <Button variant="outline" className="w-full border-border/60">
                {t.pricing.getStartedFree}
              </Button>
            </Link>
          </div>

          {/* Pro */}
          <div className="relative rounded-2xl border-2 border-violet-500 bg-card p-8 flex flex-col shadow-2xl shadow-violet-500/10">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-1 text-xs font-semibold text-white shadow-sm shadow-violet-600/40">
                <Sparkles className="h-3 w-3" />
                {t.pricing.mostPopular}
              </span>
            </div>

            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-violet-100 dark:bg-violet-900/40 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300 mb-3">
                {t.pricing.proTier}
              </div>
              <p className="text-sm text-muted-foreground">{t.pricing.proTagline}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">
                  ${displayPrice}
                </span>
                <span className="text-muted-foreground text-sm">{billingLabel}</span>
              </div>
              {annual && (
                <p className="mt-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
                  {t.pricing.monthlyEquiv.replace("{price}", monthlyEquiv)}
                </p>
              )}
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {PRO_FEATURES.map((f) => (
                <li key={f.text} className="flex items-center gap-3 text-sm">
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      f.pro
                        ? "bg-violet-100 dark:bg-violet-900/50"
                        : "bg-muted"
                    }`}
                  >
                    <Check
                      className={`h-3 w-3 ${
                        f.pro
                          ? "text-violet-600 dark:text-violet-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <span className={f.pro ? "font-medium" : "text-muted-foreground"}>
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href={`/dashboard/billing?checkout=pro&billing=${annual ? "annual" : "monthly"}`}
            >
              <Button className="w-full">
                {t.pricing.upgradePro}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Trust note */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          {t.pricing.trustNote}
        </p>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-2xl px-4 pb-24">
        <div className="flex items-center gap-3 mb-10">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
            <HelpCircle className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t.pricing.faqTitle}
          </h2>
        </div>
        <div className="divide-y divide-border/50">
          {FAQS.map((faq) => (
            <div key={faq.q} className="py-6">
              <h3 className="font-semibold mb-2">{faq.q}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
