"use client";

import Link from "next/link";
import { Check, Zap, HelpCircle, ArrowRight, Sparkles, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CreditPack } from "@/lib/types";

export function PricingClient({
  packs,
  publishCost,
  signupGrant,
}: {
  packs: CreditPack[];
  publishCost: number;
  signupGrant: number;
}) {
  const signupPublishes = publishCost > 0 ? Math.floor(signupGrant / publishCost) : signupGrant;
  const faqs: { q: string; a: string }[] = [
    {
      q: "How do credits work?",
      a: `Every new account gets ${signupGrant} free credits, enough to publish ${signupPublishes} spaces. Publishing a space costs ${publishCost} credits. Chatting with the AI agent on your profile bills per token from your paid balance.`,
    },
    {
      q: "Do credits expire?",
      a: "Paid credits never expire. Free signup credits are space-only and stay on your account indefinitely too.",
    },
    {
      q: "What's the difference between free and paid credits?",
      a: "Free credits can only be spent on publishing spaces. Paid credits can be spent on anything — spaces or AI chat. When you publish, free credits are used first.",
    },
    {
      q: "Can I get a refund?",
      a: "Yes — within 14 days of purchase, contact support and we'll refund unused credits.",
    },
    {
      q: "Is my payment information secure?",
      a: "Payments are processed by Stripe, a PCI-compliant payment processor. We never store your card details.",
    },
  ];

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 -translate-x-1/2 top-0 h-[500px] w-[700px] rounded-full bg-violet-100/40 blur-3xl dark:bg-violet-950/20" />
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200/60 bg-violet-50/80 px-4 py-1.5 dark:border-violet-800/60 dark:bg-violet-950/40">
          <Coins className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
            Pay as you go
          </span>
        </div>

        <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-bold tracking-tight leading-[1.1]">
          Credits.{" "}
          <span className="text-violet-600">No subscriptions.</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-md mx-auto">
          Get {signupGrant} free credits when you sign up. Top up whenever you need more. Credits never expire.
        </p>
      </section>

      {/* Pack cards */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        {packs.length > 0 ? (
          <div className="grid sm:grid-cols-3 gap-6">
            {packs.map((pack, idx) => {
              const isBestValue = idx === 1;
              return (
                <div
                  key={pack.id}
                  className={`relative rounded-2xl border p-8 flex flex-col bg-card ${
                    isBestValue
                      ? "border-2 border-violet-500 shadow-2xl shadow-violet-500/10"
                      : "border-border/60"
                  }`}
                >
                  {isBestValue && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-1 text-xs font-semibold text-white shadow-sm shadow-violet-600/40">
                        <Sparkles className="h-3 w-3" />
                        Best value
                      </span>
                    </div>
                  )}
                  {/* Price leads so it reads as money, not a credit count —
                      a one-time top-up, not a plan. */}
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold tracking-tight">
                      ${(pack.price_cents / 100).toFixed(0)}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">one-time</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {pack.credits.toLocaleString()} credits
                  </p>
                  <ul className="space-y-2.5 mt-6 mb-8 text-sm flex-1">
                    <li className="flex items-center gap-2.5">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/50">
                        <Check className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                      </div>
                      <span>{publishCost > 0 ? Math.floor(pack.credits / publishCost) : pack.credits} space publishes</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/50">
                        <Check className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                      </div>
                      <span>Use for AI chat too</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/50">
                        <Check className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                      </div>
                      <span>Never expires</span>
                    </li>
                  </ul>
                  <Link href="/dashboard/credits">
                    <Button variant={isBestValue ? "default" : "outline"} className="w-full">
                      Get {pack.credits.toLocaleString()} credits
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">
            No packs available yet — check back soon.
          </p>
        )}

        <div className="mt-10 rounded-2xl border border-border/40 bg-muted/30 px-6 py-5 max-w-2xl mx-auto">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">New here? Start free.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Every new account gets {signupGrant} free credits — enough to publish {signupPublishes} spaces. No credit card required.
              </p>
              <Link href="/login?tab=signup" className="text-xs font-semibold text-violet-600 dark:text-violet-400 mt-2 inline-flex items-center gap-1 hover:underline">
                Create your account →
              </Link>
            </div>
          </div>
        </div>
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
