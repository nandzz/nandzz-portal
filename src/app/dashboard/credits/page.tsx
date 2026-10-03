export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Check,
  History,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Lock,
  Layers,
  CalendarCheck,
  Plug,
  BarChart3,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { BuyCreditsButton } from "./BuyCreditsButton";
import { PlanCheckoutButton } from "./PlanCheckoutButton";
import { ManageBillingButton } from "./ManageBillingButton";
import { BillingIntervalToggle } from "./BillingIntervalToggle";
import type { CreditPack, CreditLedgerEntry, SubscriptionPlan } from "@/lib/types";
import { getUserPlan } from "@/lib/plan";
import { getFeatureFlags } from "@/lib/featureFlags";
import { PageShell } from "@/components/layout/PageShell";
import { getServerTranslations } from "@/lib/i18n/server";
import type { Translations } from "@/lib/i18n/translations";

const PAGE_SIZE = 25;

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: (currency || "eur").toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

// Always render with 2 decimals — used for the "effective €/mo billed annually"
// subline where the amount is rarely a round number.
function formatPriceDecimals(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: (currency || "eur").toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; subscribed?: string; page?: string; interval?: string }>;
}) {
  const params = await searchParams;
  // Billing cadence carried over from the pricing page link (?interval=year).
  const billingInterval: "month" | "year" = params.interval === "year" ? "year" : "month";
  const supabase = await createClient();

  const userId = await getUserIdFromClaims(supabase);
  if (!userId) redirect("/login?redirect=/dashboard/credits");

  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [plan, { data: plans }, { data: packs }, { data: ledger, count }] = await Promise.all([
    getUserPlan(userId),
    supabase
      .from("subscription_plans")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("credit_packs")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("credit_ledger")
      // The DB column is still named `balance_after_free`, but it now holds the
      // plan-bucket balance — alias it so readers see `balance_after_plan`.
      .select("*, balance_after_plan:balance_after_free", { count: "exact" })
      .eq("user_id", userId)
      // Reservation hold/release/refund rows are internal bookkeeping — the
      // user-visible delta is captured by the corresponding usage or refund row.
      .not("reason", "in", "(llm_reservation_hold,llm_reservation_release,llm_reservation_refund)")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
  ]);

  const [{ ai: aiEnabled }, t] = await Promise.all([getFeatureFlags(), getServerTranslations()]);
  const ts = t.subscription;
  const subscriptionPlans = (plans ?? []) as SubscriptionPlan[];
  const isPaid = plan.slug !== "free";
  // Complimentary (admin-granted) Pro access — not a real Stripe subscription,
  // so Stripe-portal actions must be hidden and the convert CTA is surfaced.
  const isComp = plan.status === "comp";
  const compUntil = formatDate(plan.compExpiresAt);
  const periodEnd = formatDate(plan.periodEnd);
  // Cancelled-but-still-active: Stripe keeps status "active" until the period
  // ends, so the plan stays usable until `periodEnd`, then drops to Free.
  const isCanceling = isPaid && !isComp && plan.cancelAtPeriodEnd;
  const showSuccess = params.success === "1";
  const showCanceled = params.canceled === "1";
  const showSubscribed = params.subscribed === "1";

  const currentPlanRow = subscriptionPlans.find((p) => p.slug === plan.slug);
  const currentSort = currentPlanRow?.sort_order ?? 0;

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute right-0 top-0 h-[300px] w-[300px] rounded-full bg-violet-100/30 blur-3xl dark:bg-violet-950/15" />
      </div>

      <PageShell width="content">
        {/* Header */}
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
            <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{ts.title}</h1>
            <p className="text-muted-foreground mt-0.5">
              {aiEnabled ? ts.subtitleWithAi : ts.subtitle}
            </p>
          </div>
        </div>

        {showSubscribed && (
          <div className="mb-6 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3 flex items-center gap-3">
            <Check className="h-5 w-5 text-green-600 shrink-0" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              {ts.subscribedMsg}
            </p>
          </div>
        )}
        {showSuccess && (
          <div className="mb-6 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3 flex items-center gap-3">
            <Check className="h-5 w-5 text-green-600 shrink-0" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              {ts.paymentReceivedMsg}
            </p>
          </div>
        )}
        {showCanceled && (
          <div className="mb-6 rounded-xl bg-muted border border-border/60 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {ts.canceledMsg}
            </p>
          </div>
        )}

        {isComp && (
          <div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50/60 p-5 dark:border-violet-900/50 dark:bg-violet-950/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/40">
                  <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="font-semibold">
                    {compUntil ? ts.compTitleUntil.replace("{date}", compUntil) : ts.compTitle}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {ts.compDesc}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <PlanCheckoutButton
                  planSlug="pro"
                  interval={billingInterval}
                  label={ts.subscribeToKeep}
                />
              </div>
            </div>
          </div>
        )}

        {/* Current plan */}
        <div className="rounded-2xl border border-border/60 bg-card p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{ts.currentPlan}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold tracking-tight">{plan.name}</p>
                {isCanceling ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    {ts.statusCanceling}
                  </span>
                ) : (
                  plan.status && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {statusLabel(plan.status, ts)}
                    </span>
                  )
                )}
              </div>
              {currentPlanRow && currentPlanRow.price_cents > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {formatPrice(currentPlanRow.price_cents, currentPlanRow.currency)}
                  {currentPlanRow.billing_interval === "year" ? ts.perYear : ts.perMonth}
                  {periodEnd &&
                    ` · ${(isCanceling ? ts.activeUntil : ts.renews).replace("{date}", periodEnd)}`}
                </p>
              )}
              {isCanceling && (
                <p className="text-sm text-muted-foreground mt-2">
                  {(periodEnd ? ts.cancelNotice.replace("{date}", periodEnd) : ts.cancelNoticeNoDate).replace(
                    "{plan}",
                    plan.name,
                  )}{" "}
                  <ManageBillingButton variant="link">{ts.reactivateYourPlan}</ManageBillingButton>
                </p>
              )}
            </div>
            {isPaid && !isComp && (
              <ManageBillingButton>
                {isCanceling ? ts.reactivate : ts.manageCancel}
              </ManageBillingButton>
            )}
          </div>
        </div>

        {/* Plan chooser — only ever surfaces plans *above* the current tier.
            Downgrading or cancelling is handled through the Stripe portal
            ("Manage / cancel" on the current-plan card), so we never re-list the
            active plan or lower tiers here. A paid user on the top tier sees a
            "top plan" state instead of an empty grid. */}
        {subscriptionPlans.length > 0 && (() => {
          const upgradePlans = subscriptionPlans.filter(
            (p) => p.slug !== "free" && p.sort_order > currentSort,
          );
          // Only offer the cadence toggle when a surfaced plan actually carries an
          // annual price (populated by the admin "Sync to Stripe").
          const annualAvailable = upgradePlans.some(
            (p) => p.price_cents > 0 && (p.annual_price_cents ?? 0) > 0,
          );
          return (
            <div className="mb-10">
              <h2 className="text-lg font-semibold mb-4">
                {isPaid ? ts.upgradeYourPlan : ts.plans}
              </h2>
              {upgradePlans.length > 0 && annualAvailable && (
                <BillingIntervalToggle interval={billingInterval} />
              )}
              {upgradePlans.length === 0 ? (
                <div className="rounded-2xl border border-border/60 bg-card p-6 flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/40">
                    <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="font-semibold">{ts.onProTitle}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {ts.onProDesc}
                      {aiEnabled && ts.onProDescAi}
                    </p>
                  </div>
                </div>
              ) : upgradePlans.length === 1 ? (
                // A single upgrade target (the common Free → Pro case) gets a wide
                // "showcase" card: a pricing rail on the left, the full value of the
                // plan laid out as a labelled feature grid on the right — so the
                // horizontal space sells the plan instead of sitting empty.
                (() => {
                  const p = upgradePlans[0];
                  const showAnnual =
                    billingInterval === "year" && p.price_cents > 0 && (p.annual_price_cents ?? 0) > 0;
                  const planInterval: "month" | "year" = showAnnual ? "year" : "month";
                  const displayCents = showAnnual ? (p.annual_price_cents ?? 0) : p.price_cents;
                  const perMonthCents = showAnnual ? Math.round((p.annual_price_cents ?? 0) / 12) : 0;
                  const saveCents = showAnnual ? p.price_cents * 12 - (p.annual_price_cents ?? 0) : 0;
                  // Trials only apply to a first paid subscription.
                  const hasTrial = !isPaid && p.trial_days > 0;
                  return (
                    <div className="relative overflow-hidden rounded-3xl border border-violet-200/70 bg-card shadow-xl shadow-violet-500/5 dark:border-violet-900/50">
                      <div className="grid md:grid-cols-[minmax(0,0.85fr)_1fr]">
                        {/* Pricing rail */}
                        <div className="relative flex flex-col gap-6 border-b border-border/50 bg-gradient-to-b from-violet-50/70 to-transparent p-8 md:border-b-0 md:border-r dark:from-violet-950/20">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-semibold">{p.name}</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                              <Sparkles className="h-2.5 w-2.5" />
                              {ts.mostPopular}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-5xl font-bold tracking-tight">
                                {formatPrice(displayCents, p.currency)}
                              </span>
                              <span className="text-base font-medium text-muted-foreground">{planInterval === "year" ? ts.perYear : ts.perMonth}</span>
                            </div>
                            {showAnnual ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                  {ts.perMonthBilledAnnually.replace("{price}", formatPriceDecimals(perMonthCents, p.currency))}
                                </span>
                                {saveCents > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                    {ts.savePerYear.replace("{amount}", formatPrice(saveCents, p.currency))}
                                  </span>
                                )}
                              </div>
                            ) : annualAvailable ? (
                              <p className="mt-2 text-sm text-muted-foreground">
                                {ts.switchAnnual}
                              </p>
                            ) : null}
                          </div>

                          {hasTrial && (
                            <p className="inline-flex w-fit items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                              <Sparkles className="h-2.5 w-2.5" />
                              {ts.trialBadge.replace("{days}", String(p.trial_days))}
                            </p>
                          )}

                          <div>
                            <PlanCheckoutButton
                              planSlug={p.slug}
                              interval={planInterval}
                              className="h-12 rounded-xl text-base font-semibold"
                              label={hasTrial ? ts.startTrial.replace("{days}", String(p.trial_days)) : ts.upgradeNow}
                            />
                            <p className="mt-3 text-center text-xs text-muted-foreground">
                              {hasTrial
                                ? ts.trialThen
                                    .replace("{days}", String(p.trial_days))
                                    .replace("{price}", formatPrice(displayCents, p.currency))
                                    .replace("{interval}", planInterval === "year" ? ts.perYear : ts.perMonth)
                                : ""}
                              {ts.cancelAnytime}
                            </p>
                          </div>

                          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              {ts.cancelAnytimeShort}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Lock className="h-3.5 w-3.5" />
                              {ts.secureCheckout}
                            </span>
                          </div>
                        </div>

                        {/* Value rail */}
                        <div className="p-8">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {ts.everythingYouGet}
                          </p>
                          <ul className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
                            {buildPlanFeatures(p, aiEnabled, ts).map((f) => (
                              <FeatureRow key={f.title} {...f} />
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {upgradePlans.map((p, idx) => {
                    // Draw the eye to the immediate next tier.
                    const recommended = idx === 0;
                    // Honor the cadence the user picked on /pricing when an annual
                    // price exists for this plan.
                    const showAnnual =
                      billingInterval === "year" && p.price_cents > 0 && (p.annual_price_cents ?? 0) > 0;
                    const planInterval: "month" | "year" = showAnnual ? "year" : "month";
                    const displayCents = showAnnual ? (p.annual_price_cents ?? 0) : p.price_cents;
                    const perMonthCents = showAnnual ? Math.round((p.annual_price_cents ?? 0) / 12) : 0;
                    const saveCents = showAnnual ? p.price_cents * 12 - (p.annual_price_cents ?? 0) : 0;
                    return (
                      <div
                        key={p.id}
                        className={`relative rounded-2xl border p-6 flex flex-col ${
                          recommended
                            ? "border-violet-500 bg-card shadow-lg shadow-violet-500/10"
                            : "border-border/60 bg-card"
                        }`}
                      >
                        {p.slug === "pro" && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-0.5 text-[10px] font-semibold text-white">
                              <Sparkles className="h-2.5 w-2.5" />
                              {ts.popular}
                            </span>
                          </div>
                        )}
                        <p className="font-semibold">{p.name}</p>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-3xl font-bold">
                            {p.price_cents === 0 ? ts.free : formatPrice(displayCents, p.currency)}
                          </span>
                          {p.price_cents > 0 && (
                            <span className="text-sm font-medium text-muted-foreground">{planInterval === "year" ? ts.perYear : ts.perMonth}</span>
                          )}
                        </div>
                        {showAnnual && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {ts.perMonthBilledAnnually.replace("{price}", formatPriceDecimals(perMonthCents, p.currency))}
                            </span>
                            {saveCents > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                {ts.save.replace("{amount}", formatPrice(saveCents, p.currency))}
                              </span>
                            )}
                          </div>
                        )}
                        {p.price_cents > 0 && p.trial_days > 0 && (
                          <p className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                            <Sparkles className="h-2.5 w-2.5" />
                            {ts.trialBadge.replace("{days}", String(p.trial_days))}
                          </p>
                        )}
                        <ul className="mt-4 mb-6 space-y-2 text-sm flex-1">
                          <PlanFeature ok>{p.space_limit === null ? ts.unlimitedSpaces : ts.spacesCount.replace("{count}", String(p.space_limit))}</PlanFeature>
                          <PlanFeature ok={p.has_widgets}>{aiEnabled ? ts.bookingAndAgent : ts.booking}</PlanFeature>
                          {aiEnabled && (
                            <PlanFeature ok={p.monthly_credits > 0}>
                              {p.monthly_credits > 0 ? ts.aiCreditsPerMo.replace("{count}", p.monthly_credits.toLocaleString()) : ts.noAiCredits}
                            </PlanFeature>
                          )}
                          <PlanFeature ok={p.has_mcp}>{ts.mcpAccess}</PlanFeature>
                          <PlanFeature ok={p.has_analytics}>{ts.analytics}</PlanFeature>
                        </ul>
                        <div className="mt-auto">
                          <PlanCheckoutButton
                            planSlug={p.slug}
                            interval={planInterval}
                            label={
                              // Trials only apply to a first paid subscription;
                              // an already-paying user upgrading just "Upgrade"s.
                              !isPaid && p.trial_days > 0
                                ? ts.startTrial.replace("{days}", String(p.trial_days))
                                : ts.upgrade
                            }
                            variant={recommended ? "default" : "outline"}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Credit balances — AI only */}
        {aiEnabled && (
        <div className="rounded-2xl border border-border/60 bg-card p-6 mb-8">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{ts.aiCredits}</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-muted/40 border border-border/40 px-4 py-3">
              <p className="text-xs text-muted-foreground">{ts.monthlyPlanCredits}</p>
              <p className="font-semibold text-2xl mt-0.5">{plan.planCredits.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {periodEnd ? ts.resetsOn.replace("{date}", periodEnd) : ts.resetsEachPeriod}
              </p>
            </div>
            <div className="rounded-lg bg-violet-50/40 dark:bg-violet-950/30 border border-violet-200/40 dark:border-violet-800/40 px-4 py-3">
              <p className="text-xs text-violet-700/80 dark:text-violet-300/80">{ts.purchasedCredits}</p>
              <p className="font-semibold text-2xl mt-0.5 text-violet-700 dark:text-violet-300">
                {plan.paidCredits.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{ts.neverExpires}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            {ts.creditsSpentNote}
          </p>
        </div>
        )}

        {/* Buy more credits — paid plans only. AI only. */}
        {aiEnabled && (isPaid ? (
          packs && packs.length > 0 ? (
            <div className="mb-10">
              <h2 className="text-lg font-semibold mb-4">{ts.buyMoreCredits}</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {(packs as CreditPack[]).map((pack, idx) => (
                  <div
                    key={pack.id}
                    className={`relative rounded-2xl border p-6 flex flex-col ${
                      idx === 1
                        ? "border-violet-500 bg-card shadow-lg shadow-violet-500/10"
                        : "border-border/60 bg-card"
                    }`}
                  >
                    {idx === 1 && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-0.5 text-[10px] font-semibold text-white">
                          <Sparkles className="h-2.5 w-2.5" />
                          {ts.bestValue}
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold">{formatPrice(pack.price_cents, pack.currency)}</span>
                      <span className="text-sm font-medium text-muted-foreground">{ts.oneTime}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{ts.creditsCount.replace("{count}", pack.credits.toLocaleString())}</p>
                    <div className="mt-5">
                      <BuyCreditsButton packId={pack.id} credits={pack.credits} highlighted={idx === 1} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {ts.purchasedNeverExpireNote}
              </p>
            </div>
          ) : null
        ) : (
          <div className="mb-10 rounded-2xl border border-violet-200 bg-violet-50/60 p-6 text-center dark:border-violet-900/50 dark:bg-violet-950/20">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/40">
              <Lock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold">{ts.upgradeToUseAi}</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {ts.upgradeToUseAiDesc}
            </p>
          </div>
        ))}

        {/* Ledger — AI usage/credit activity only */}
        {aiEnabled && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{ts.activity}</h2>
          </div>
          {ledger && ledger.length > 0 ? (
            <>
              <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">{ts.colWhen}</th>
                      <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">{ts.colReason}</th>
                      <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">{ts.colBucket}</th>
                      <th className="text-right font-medium text-xs text-muted-foreground px-4 py-2.5">{ts.colChange}</th>
                      <th className="text-right font-medium text-xs text-muted-foreground px-4 py-2.5">{ts.colBalance}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ledger as CreditLedgerEntry[]).map((entry) => (
                      <tr key={entry.id} className="border-b border-border/30 last:border-0">
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">
                          {new Date(entry.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-2.5 font-medium">{formatReason(entry.reason, ts)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">
                          {entry.bucket === "plan" ? ts.bucketMonthly : ts.bucketPurchased}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-mono tabular-nums font-semibold ${
                            entry.delta < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {entry.delta > 0 ? "+" : ""}
                          {entry.delta.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground text-xs tabular-nums">
                          {(entry.balance_after_plan + entry.balance_after_paid).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{ts.pageOf.replace("{page}", String(page)).replace("{total}", String(totalPages))}</p>
                  <div className="flex items-center gap-2">
                    {page > 1 ? (
                      <Link href={`/dashboard/credits?page=${page - 1}`}>
                        <Button variant="outline" size="sm" className="gap-1">
                          <ChevronLeft className="h-4 w-4" /> {ts.prev}
                        </Button>
                      </Link>
                    ) : (
                      <Button variant="outline" size="sm" className="gap-1" disabled>
                        <ChevronLeft className="h-4 w-4" /> {ts.prev}
                      </Button>
                    )}
                    {page < totalPages ? (
                      <Link href={`/dashboard/credits?page=${page + 1}`}>
                        <Button variant="outline" size="sm" className="gap-1">
                          {ts.next} <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Button variant="outline" size="sm" className="gap-1" disabled>
                        {ts.next} <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{ts.noActivity}</p>
          )}
        </div>
        )}

        <div className="pt-8">
          <Link href="/dashboard/contents">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <LayoutGrid className="h-4 w-4" />
              {ts.backToContent}
            </Button>
          </Link>
        </div>

        <div className="pt-2 text-xs text-muted-foreground">
          <Link href="/pricing" className="underline underline-offset-2">
            {ts.seePlans}
          </Link>
          {isPaid && !isComp && (
            <>
              {" · "}
              <ManageBillingButton variant="link">{ts.viewInvoices}</ManageBillingButton>
            </>
          )}
        </div>
      </PageShell>
    </div>
  );
}

type PlanFeatureItem = {
  icon: LucideIcon;
  title: string;
  description: string;
  ok: boolean;
};

// The rich, described feature set shown on the single-plan showcase card. Each
// row pairs the capability with a plain-language "what you can do with it" line,
// so the plan reads as value rather than a checklist of nouns.
function buildPlanFeatures(
  p: SubscriptionPlan,
  aiEnabled: boolean,
  ts: Translations["subscription"],
): PlanFeatureItem[] {
  const items: PlanFeatureItem[] = [
    {
      icon: Layers,
      title: p.space_limit === null ? ts.unlimitedSpaces : ts.spacesCount.replace("{count}", String(p.space_limit)),
      description: ts.unlimitedSpacesDesc,
      ok: true,
    },
    {
      icon: CalendarCheck,
      title: aiEnabled ? ts.bookingAndAgent : ts.booking,
      description: aiEnabled ? ts.bookingAgentDesc : ts.bookingDesc,
      ok: p.has_widgets,
    },
  ];
  if (aiEnabled) {
    items.push({
      icon: Sparkles,
      title: p.monthly_credits > 0 ? ts.aiCreditsTitle.replace("{count}", p.monthly_credits.toLocaleString()) : ts.noAiCredits,
      description: ts.aiCreditsDesc,
      ok: p.monthly_credits > 0,
    });
  }
  items.push(
    {
      icon: Plug,
      title: ts.mcpAccess,
      description: ts.mcpAccessDesc,
      ok: p.has_mcp,
    },
    {
      icon: BarChart3,
      title: ts.analytics,
      description: ts.analyticsDesc,
      ok: p.has_analytics,
    },
  );
  return items;
}

// Maps a Stripe subscription status to localized copy; unknown statuses fall
// back to their raw (capitalized) value.
function statusLabel(status: string, ts: Translations["subscription"]): string {
  const map: Record<string, string> = {
    active: ts.statusActive,
    comp: ts.statusComp,
    trialing: ts.statusTrialing,
    past_due: ts.statusPastDue,
    canceled: ts.statusCanceled,
    cancelled: ts.statusCanceled,
  };
  return map[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

function FeatureRow({ icon: Icon, title, description, ok }: PlanFeatureItem) {
  return (
    <li className={`flex items-start gap-3 ${ok ? "" : "opacity-45"}`}>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-tight">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{description}</span>
      </span>
    </li>
  );
}

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

function formatReason(reason: string, ts: Translations["subscription"]): string {
  const map: Record<string, string> = {
    plan_refill: ts.reasonPlanRefill,
    signup_grant: ts.reasonSignupGrant,
    admin_grant: ts.reasonAdminGrant,
    admin_revoke: ts.reasonAdminRevoke,
    stripe_purchase: ts.reasonStripePurchase,
    llm_agent_chat: ts.reasonLlmAgentChat,
    llm_page_editor: ts.reasonLlmPageEditor,
    refund: ts.reasonRefund,
    backfill: ts.reasonBackfill,
  };
  return map[reason] ?? reason;
}
