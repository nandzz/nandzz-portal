export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, History, LayoutGrid, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { BuyCreditsButton } from "./BuyCreditsButton";
import { PlanCheckoutButton } from "./PlanCheckoutButton";
import { ManageBillingButton } from "./ManageBillingButton";
import type { CreditPack, CreditLedgerEntry, SubscriptionPlan } from "@/lib/types";
import { getUserPlan } from "@/lib/plan";
import { getFeatureFlags } from "@/lib/featureFlags";
import { PageShell } from "@/components/layout/PageShell";

const PAGE_SIZE = 25;

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: (currency || "eur").toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; subscribed?: string; page?: string }>;
}) {
  const params = await searchParams;
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

  const { ai: aiEnabled } = await getFeatureFlags();
  const subscriptionPlans = (plans ?? []) as SubscriptionPlan[];
  const isPaid = plan.slug !== "free";
  const periodEnd = formatDate(plan.periodEnd);
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
            <h1 className="text-3xl font-bold tracking-tight">Subscription</h1>
            <p className="text-muted-foreground mt-0.5">
              {aiEnabled ? "Manage your plan and AI credits." : "Manage your plan."}
            </p>
          </div>
        </div>

        {showSubscribed && (
          <div className="mb-6 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3 flex items-center gap-3">
            <Check className="h-5 w-5 text-green-600 shrink-0" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              You&apos;re subscribed — your plan is now active.
            </p>
          </div>
        )}
        {showSuccess && (
          <div className="mb-6 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3 flex items-center gap-3">
            <Check className="h-5 w-5 text-green-600 shrink-0" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              Payment received — your credits have been added.
            </p>
          </div>
        )}
        {showCanceled && (
          <div className="mb-6 rounded-xl bg-muted border border-border/60 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Checkout canceled — nothing was charged.
            </p>
          </div>
        )}

        {/* Current plan */}
        <div className="rounded-2xl border border-border/60 bg-card p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Current plan</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold tracking-tight">{plan.name}</p>
                {plan.status && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground capitalize">
                    {plan.status}
                  </span>
                )}
              </div>
              {currentPlanRow && currentPlanRow.price_cents > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {formatPrice(currentPlanRow.price_cents, currentPlanRow.currency)}/{currentPlanRow.billing_interval}
                  {periodEnd && ` · renews ${periodEnd}`}
                </p>
              )}
            </div>
            {isPaid && (
              <ManageBillingButton>Manage / cancel</ManageBillingButton>
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
          return (
            <div className="mb-10">
              <h2 className="text-lg font-semibold mb-4">
                {isPaid ? "Upgrade your plan" : "Plans"}
              </h2>
              {upgradePlans.length === 0 ? (
                <div className="rounded-2xl border border-border/60 bg-card p-6 flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/40">
                    <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="font-semibold">You&apos;re on our top plan</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      You have access to every feature.
                      {aiEnabled && " Need more AI credits? Grab a credit pack below."}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className={`grid gap-4 ${
                    upgradePlans.length === 1 ? "sm:max-w-md" : "sm:grid-cols-2"
                  }`}
                >
                  {upgradePlans.map((p, idx) => {
                    // Draw the eye to the immediate next tier.
                    const recommended = idx === 0;
                    return (
                      <div
                        key={p.id}
                        className={`relative rounded-2xl border p-6 flex flex-col ${
                          recommended
                            ? "border-violet-500 bg-card shadow-lg shadow-violet-500/10"
                            : "border-border/60 bg-card"
                        }`}
                      >
                        {p.slug === "starter" && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-0.5 text-[10px] font-semibold text-white">
                              <Sparkles className="h-2.5 w-2.5" />
                              POPULAR
                            </span>
                          </div>
                        )}
                        <p className="font-semibold">{p.name}</p>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-3xl font-bold">
                            {p.price_cents === 0 ? "Free" : formatPrice(p.price_cents, p.currency)}
                          </span>
                          {p.price_cents > 0 && (
                            <span className="text-sm font-medium text-muted-foreground">/{p.billing_interval}</span>
                          )}
                        </div>
                        {p.price_cents > 0 && p.trial_days > 0 && (
                          <p className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                            <Sparkles className="h-2.5 w-2.5" />
                            {p.trial_days}-day free trial
                          </p>
                        )}
                        <ul className="mt-4 mb-6 space-y-2 text-sm flex-1">
                          <PlanFeature ok>{p.space_limit === null ? "Unlimited spaces" : `${p.space_limit} spaces`}</PlanFeature>
                          <PlanFeature ok={p.has_widgets}>Widgets</PlanFeature>
                          {aiEnabled && (
                            <PlanFeature ok={p.monthly_credits > 0}>
                              {p.monthly_credits > 0 ? `${p.monthly_credits.toLocaleString()} AI credits/mo` : "No AI credits"}
                            </PlanFeature>
                          )}
                          <PlanFeature ok={p.has_mcp}>MCP access</PlanFeature>
                          <PlanFeature ok={p.has_analytics}>Analytics</PlanFeature>
                        </ul>
                        <div className="mt-auto">
                          <PlanCheckoutButton
                            planSlug={p.slug}
                            label={
                              // Trials only apply to a first paid subscription;
                              // an already-paying user upgrading just "Upgrade"s.
                              !isPaid && p.trial_days > 0
                                ? `Start ${p.trial_days}-day free trial`
                                : "Upgrade"
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
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">AI credits</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-muted/40 border border-border/40 px-4 py-3">
              <p className="text-xs text-muted-foreground">Monthly plan credits</p>
              <p className="font-semibold text-2xl mt-0.5">{plan.planCredits.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {periodEnd ? `Resets on ${periodEnd}` : "Resets each billing period"}
              </p>
            </div>
            <div className="rounded-lg bg-violet-50/40 dark:bg-violet-950/30 border border-violet-200/40 dark:border-violet-800/40 px-4 py-3">
              <p className="text-xs text-violet-700/80 dark:text-violet-300/80">Purchased credits</p>
              <p className="font-semibold text-2xl mt-0.5 text-violet-700 dark:text-violet-300">
                {plan.paidCredits.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Never expires</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Plan credits are spent first; purchased credits are used only after they run out.
          </p>
        </div>
        )}

        {/* Buy more credits — paid plans only. AI only. */}
        {aiEnabled && (isPaid ? (
          packs && packs.length > 0 ? (
            <div className="mb-10">
              <h2 className="text-lg font-semibold mb-4">Buy more credits</h2>
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
                          BEST VALUE
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold">{formatPrice(pack.price_cents, pack.currency)}</span>
                      <span className="text-sm font-medium text-muted-foreground">one-time</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{pack.credits.toLocaleString()} credits</p>
                    <div className="mt-5">
                      <BuyCreditsButton packId={pack.id} credits={pack.credits} highlighted={idx === 1} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Purchased credits never expire. Secure checkout via Stripe.
              </p>
            </div>
          ) : null
        ) : (
          <div className="mb-10 rounded-2xl border border-violet-200 bg-violet-50/60 p-6 text-center dark:border-violet-900/50 dark:bg-violet-950/20">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/40">
              <Lock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold">Upgrade to use AI</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              AI credits are included on the Starter and Pro plans. Upgrade to chat with your agent and edit pages with AI.
            </p>
          </div>
        ))}

        {/* Ledger — AI usage/credit activity only */}
        {aiEnabled && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Activity</h2>
          </div>
          {ledger && ledger.length > 0 ? (
            <>
              <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">When</th>
                      <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Reason</th>
                      <th className="text-left font-medium text-xs text-muted-foreground px-4 py-2.5">Bucket</th>
                      <th className="text-right font-medium text-xs text-muted-foreground px-4 py-2.5">Change</th>
                      <th className="text-right font-medium text-xs text-muted-foreground px-4 py-2.5">Balance</th>
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
                        <td className="px-4 py-2.5 font-medium">{formatReason(entry.reason)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">
                          {entry.bucket === "plan" ? "Monthly" : "Purchased"}
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
                  <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
                  <div className="flex items-center gap-2">
                    {page > 1 ? (
                      <Link href={`/dashboard/credits?page=${page - 1}`}>
                        <Button variant="outline" size="sm" className="gap-1">
                          <ChevronLeft className="h-4 w-4" /> Prev
                        </Button>
                      </Link>
                    ) : (
                      <Button variant="outline" size="sm" className="gap-1" disabled>
                        <ChevronLeft className="h-4 w-4" /> Prev
                      </Button>
                    )}
                    {page < totalPages ? (
                      <Link href={`/dashboard/credits?page=${page + 1}`}>
                        <Button variant="outline" size="sm" className="gap-1">
                          Next <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Button variant="outline" size="sm" className="gap-1" disabled>
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          )}
        </div>
        )}

        <div className="pt-8">
          <Link href="/dashboard/contents">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <LayoutGrid className="h-4 w-4" />
              Back to content
            </Button>
          </Link>
        </div>

        <div className="pt-2 text-xs text-muted-foreground">
          <Link href="/pricing" className="underline underline-offset-2">
            See plans
          </Link>
          {isPaid && (
            <>
              {" · "}
              <ManageBillingButton variant="link">View invoices →</ManageBillingButton>
            </>
          )}
        </div>
      </PageShell>
    </div>
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

function formatReason(reason: string): string {
  const map: Record<string, string> = {
    plan_refill: "Monthly credits",
    signup_grant: "Welcome bonus",
    admin_grant: "Admin grant",
    admin_revoke: "Admin revoke",
    stripe_purchase: "Pack purchase",
    llm_agent_chat: "AI chat",
    llm_page_editor: "Page editor",
    refund: "Refund",
    backfill: "Migrated balance",
  };
  return map[reason] ?? reason;
}
