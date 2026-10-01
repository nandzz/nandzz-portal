"use client";

import Link from "next/link";
import { Check, Minus, HelpCircle, ArrowRight, Sparkles, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CreditPack, SubscriptionPlan } from "@/lib/types";
import type { PricingFaq } from "./faqs";

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: (currency || "eur").toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function PricingClient({
  plans,
  packs,
  faqs,
  aiEnabled,
}: {
  plans: SubscriptionPlan[];
  packs: CreditPack[];
  faqs: PricingFaq[];
  aiEnabled: boolean;
}) {
  // Only badge a "most popular" plan when there's an actual choice between paid
  // tiers — with a single paid plan the badge is noise.
  const paidPlanCount = plans.filter((p) => p.price_cents > 0).length;
  // Responsive card grid: fit the number of plans without stranding one card in
  // a 3-wide row.
  const gridClass =
    plans.length <= 1
      ? "max-w-sm mx-auto"
      : plans.length === 2
        ? "grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto"
        : "grid sm:grid-cols-3 gap-6";

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 -translate-x-1/2 top-0 h-[500px] w-[700px] rounded-full bg-violet-100/40 blur-3xl dark:bg-violet-950/20" />
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200/60 bg-violet-50/80 px-4 py-1.5 dark:border-violet-800/60 dark:bg-violet-950/40">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
            Simple plans
          </span>
        </div>

        <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-bold tracking-tight leading-[1.1]">
          One page.{" "}
          <span className="text-violet-600">Every tool.</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-md mx-auto">
          {aiEnabled
            ? "Start free. Upgrade when you want widgets, AI and analytics on your branded page."
            : "Start free. Upgrade when you want widgets and analytics on your branded page."}
        </p>
      </section>

      {/* Plan cards */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        {plans.length > 0 ? (
          <div className={gridClass}>
            {plans.map((plan) => {
              const isPopular = paidPlanCount > 1 && plan.slug === "starter";
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border p-8 flex flex-col bg-card ${
                    isPopular
                      ? "border-2 border-violet-500 shadow-2xl shadow-violet-500/10"
                      : "border-border/60"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-1 text-xs font-semibold text-white shadow-sm shadow-violet-600/40">
                        <Sparkles className="h-3 w-3" />
                        Most popular
                      </span>
                    </div>
                  )}
                  <p className="text-lg font-semibold">{plan.name}</p>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold tracking-tight">
                      {plan.price_cents === 0 ? "Free" : formatPrice(plan.price_cents, plan.currency)}
                    </span>
                    {plan.price_cents > 0 && (
                      <span className="text-sm font-medium text-muted-foreground">/{plan.billing_interval}</span>
                    )}
                  </div>
                  {plan.price_cents > 0 && plan.trial_days > 0 && (
                    <p className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                      <Sparkles className="h-3 w-3" />
                      {plan.trial_days}-day free trial
                    </p>
                  )}
                  {plan.description && (
                    <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                  )}

                  <ul className="space-y-2.5 mt-6 mb-8 text-sm flex-1">
                    <Feature ok>
                      {plan.space_limit === null ? "Unlimited spaces" : `Up to ${plan.space_limit} spaces`}
                    </Feature>
                    <Feature ok>Content, gallery &amp; links sections</Feature>
                    <Feature ok={plan.has_widgets}>
                      {aiEnabled ? "Widgets (booking + AI agent)" : "Widgets (booking)"}
                    </Feature>
                    {aiEnabled && (
                      <Feature ok={plan.monthly_credits > 0}>
                        {plan.monthly_credits > 0
                          ? `${plan.monthly_credits.toLocaleString()} AI credits / month`
                          : "No AI credits"}
                      </Feature>
                    )}
                    <Feature ok={plan.has_mcp}>MCP access (connect Claude)</Feature>
                    <Feature ok={plan.has_analytics}>Analytics</Feature>
                  </ul>

                  <Link href={plan.price_cents === 0 ? "/login?tab=signup" : "/dashboard/credits"}>
                    <Button variant={isPopular ? "default" : "outline"} className="w-full">
                      {plan.price_cents === 0
                        ? "Get started"
                        : plan.trial_days > 0
                          ? "Start free trial"
                          : `Choose ${plan.name}`}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">
            Plans aren&apos;t available yet — check back soon.
          </p>
        )}

        {packs.length > 0 && (
          <div className="mt-10 rounded-2xl border border-border/40 bg-muted/30 px-6 py-5 max-w-2xl mx-auto">
            <div className="flex items-start gap-3">
              <Layers className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Need more AI credits?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  On a paid plan you can buy top-up credit packs (from{" "}
                  {formatPrice(
                    Math.min(...packs.map((p) => p.price_cents)),
                    packs[0].currency
                  )}
                  ) any time. Top-up credits never expire and are used only after your monthly allowance.
                </p>
                <Link
                  href="/dashboard/credits"
                  className="text-xs font-semibold text-violet-600 dark:text-violet-400 mt-2 inline-flex items-center gap-1 hover:underline"
                >
                  Manage your subscription →
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-2xl px-4 pb-24">
        <div className="flex items-center gap-3 mb-10">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
            <HelpCircle className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Frequently asked</h2>
        </div>
        <div className="divide-y divide-border/50">
          {faqs.map((faq) => (
            <div key={faq.q} className="py-6">
              <h3 className="font-semibold mb-2">{faq.q}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Feature({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2.5 ${ok ? "" : "text-muted-foreground/60"}`}>
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          ok ? "bg-violet-100 dark:bg-violet-900/50" : "bg-muted"
        }`}
      >
        {ok ? (
          <Check className="h-3 w-3 text-violet-600 dark:text-violet-400" />
        ) : (
          <Minus className="h-3 w-3 text-muted-foreground/50" />
        )}
      </div>
      <span>{children}</span>
    </li>
  );
}
