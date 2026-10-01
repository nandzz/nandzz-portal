"use client";

import { useState } from "react";
import { Lock, Check, Sparkles } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { renderWidgetIcon } from "@/features/booking";
import { PlanCheckoutButton } from "../credits/PlanCheckoutButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFeatureFlags } from "@/features/analytics/AuthContext";
import type { SubscriptionPlan, WidgetCatalogEntry } from "@/lib/types";

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: (currency || "eur").toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

// Feature row — mirrors the plan chooser on /dashboard/credits so the modal
// reads as the same product surface.
function PlanFeature({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "" : "text-muted-foreground/60"}`}>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          ok ? "bg-violet-100 dark:bg-violet-900/50" : "bg-muted"
        }`}
      >
        {ok ? (
          <Check className="h-3 w-3 text-violet-600 dark:text-violet-400" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        )}
      </span>
      <span>{children}</span>
    </li>
  );
}

// Locked variant of the "Add a widget" grid, shown to business accounts whose
// plan doesn't include widgets. Every catalog entry renders as a non-actionable
// card badged with the plans that unlock it; tapping any card opens the
// subscription modal (Stripe Checkout per plan) instead of adding the widget.
export function WidgetPaywall({
  catalog,
  widgetPlans,
}: {
  catalog: WidgetCatalogEntry[];
  widgetPlans: SubscriptionPlan[];
}) {
  const { t } = useLanguage();
  const { ai: aiEnabled } = useFeatureFlags();
  const [open, setOpen] = useState(false);

  const planNames = widgetPlans.map((p) => p.name).join(", ");

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {catalog.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setOpen(true)}
            className="group rounded-2xl border border-border bg-background p-5 text-left transition hover:border-emerald-400 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  {renderWidgetIcon(c.icon, "h-4 w-4 text-muted-foreground")}
                </div>
                <p className="font-semibold">{c.name}</p>
              </div>
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
            {c.description && <p className="mt-3 text-sm text-muted-foreground">{c.description}</p>}
            {planNames && (
              <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {t.plan.includedIn} {planNames}
              </span>
            )}
          </button>
        ))}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t.plan.widgetsLockedTitle}
        maxWidthClass="max-w-md sm:max-w-2xl"
      >
        <p className="text-sm text-muted-foreground">{t.plan.widgetsLocked}</p>
        {/* Stacked on mobile (scrollable so the cards never push past the
            viewport), side by side on desktop where there's room for both.
            Extra top padding keeps the POPULAR badge from clipping. */}
        <div className="mt-5 grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto px-1 pt-3 sm:max-h-none sm:grid-cols-2 sm:overflow-visible">
          {widgetPlans.map((plan) => {
            const highlighted = plan.slug === "starter";
            const hasTrial = plan.price_cents > 0 && plan.trial_days > 0;
            return (
              <div
                key={plan.slug}
                className={`relative flex flex-col rounded-2xl border p-5 ${
                  highlighted
                    ? "border-violet-500 bg-card shadow-lg shadow-violet-500/10"
                    : "border-border/60 bg-card"
                }`}
              >
                {highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-0.5 text-[10px] font-semibold text-white">
                      <Sparkles className="h-2.5 w-2.5" />
                      POPULAR
                    </span>
                  </div>
                )}
                <p className="font-semibold">{plan.name}</p>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold">{formatPrice(plan.price_cents, plan.currency)}</span>
                  <span className="text-sm font-medium text-muted-foreground">/{plan.billing_interval}</span>
                </div>
                {hasTrial && (
                  <p className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                    <Sparkles className="h-3 w-3" />
                    {plan.trial_days}-day free trial
                  </p>
                )}
                <ul className="mt-4 mb-5 space-y-2 text-sm">
                  <PlanFeature ok>{plan.space_limit === null ? "Unlimited spaces" : `${plan.space_limit} spaces`}</PlanFeature>
                  <PlanFeature ok={plan.has_widgets}>Widgets</PlanFeature>
                  {aiEnabled && (
                    <PlanFeature ok={plan.monthly_credits > 0}>
                      {plan.monthly_credits > 0 ? `${plan.monthly_credits.toLocaleString()} AI credits/mo` : "No AI credits"}
                    </PlanFeature>
                  )}
                  <PlanFeature ok={plan.has_mcp}>MCP access</PlanFeature>
                  <PlanFeature ok={plan.has_analytics}>Analytics</PlanFeature>
                </ul>
                <div className="mt-auto">
                  <PlanCheckoutButton
                    planSlug={plan.slug}
                    label={hasTrial ? `Start ${plan.trial_days}-day free trial` : t.plan.subscribe}
                    variant={highlighted ? "default" : "outline"}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Dialog>
    </>
  );
}
