export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Coins, Sparkles, Check, History, LayoutGrid } from "lucide-react";
import { BuyCreditsButton } from "./BuyCreditsButton";
import type { CreditPack, CreditLedgerEntry } from "@/lib/types";
import { getCreditsConfig } from "@/lib/credits-config";

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/credits");

  const [{ data: profile }, { data: packs }, { data: ledger }, creditsConfig] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, username, free_space_credits, paid_credits")
      .eq("id", user.id)
      .single(),
    supabase
      .from("credit_packs")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("credit_ledger")
      .select("*")
      .eq("user_id", user.id)
      // Reservation hold/release/refund rows are internal bookkeeping — the
      // user-visible delta is captured by the corresponding usage or refund
      // row. Hide them so the activity table stays readable.
      .not("reason", "in", "(llm_reservation_hold,llm_reservation_release,llm_reservation_refund)")
      .order("created_at", { ascending: false })
      .limit(25),
    getCreditsConfig(),
  ]);

  const publishCost = creditsConfig.publishCost;

  const freeCredits = profile?.free_space_credits ?? 0;
  const paidCredits = profile?.paid_credits ?? 0;
  const totalCredits = freeCredits + paidCredits;
  const showSuccess = params.success === "1";
  const showCanceled = params.canceled === "1";

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute right-0 top-0 h-[300px] w-[300px] rounded-full bg-violet-100/30 blur-3xl dark:bg-violet-950/15" />
      </div>

      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
            <Coins className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Credits</h1>
            <p className="text-muted-foreground mt-0.5">
              Buy credits to publish spaces and chat with your AI agent.
            </p>
          </div>
        </div>

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
              Checkout canceled — no credits were charged.
            </p>
          </div>
        )}

        {/* Balance card */}
        <div className="rounded-2xl border border-border/60 bg-card p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total balance</p>
              <p className="text-4xl font-bold tracking-tight">
                {totalCredits.toLocaleString()}{" "}
                <span className="text-base font-normal text-muted-foreground">credits</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg bg-muted/40 border border-border/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">Free (spaces only)</p>
                <p className="font-semibold text-base mt-0.5">{freeCredits.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-violet-50/40 dark:bg-violet-950/30 border border-violet-200/40 dark:border-violet-800/40 px-3 py-2">
                <p className="text-xs text-violet-700/80 dark:text-violet-300/80">Paid (anywhere)</p>
                <p className="font-semibold text-base mt-0.5 text-violet-700 dark:text-violet-300">
                  {paidCredits.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Publishing a space costs {publishCost} credits. LLM chat is billed per token from your paid balance.
          </p>
        </div>

        {/* Credit pack cards */}
        {packs && packs.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold mb-4">Buy credits</h2>
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
                  <p className="font-semibold">{pack.name}</p>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      ${(pack.price_cents / 100).toFixed(0)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {pack.credits.toLocaleString()} credits
                  </p>
                  <div className="mt-5">
                    <BuyCreditsButton packId={pack.id} packName={pack.name} highlighted={idx === 1} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Paid credits never expire. Secure checkout via Stripe.
            </p>
          </div>
        )}

        {/* Ledger */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Activity</h2>
          </div>
          {ledger && ledger.length > 0 ? (
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <table className="w-full text-sm">
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
                        {entry.bucket === "free_space" ? "Free" : "Paid"}
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
                        {(entry.balance_after_free + entry.balance_after_paid).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          )}
        </div>

        <div className="pt-8">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <LayoutGrid className="h-4 w-4" />
              Back to spaces
            </Button>
          </Link>
        </div>

        <div className="pt-2 text-xs text-muted-foreground">
          <Link href="/pricing" className="underline underline-offset-2">
            See pack pricing
          </Link>
          {" · "}
          <form action="/api/stripe/portal" method="POST" className="inline">
            <button type="submit" className="underline underline-offset-2 hover:text-foreground">
              View invoices →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function formatReason(reason: string): string {
  const map: Record<string, string> = {
    signup_grant: "Welcome bonus",
    admin_grant: "Admin grant",
    admin_revoke: "Admin revoke",
    stripe_purchase: "Pack purchase",
    publish_space: "Published space",
    llm_agent_chat: "AI chat",
    llm_page_editor: "Page editor",
    refund: "Refund",
    backfill: "Migrated balance",
  };
  return map[reason] ?? reason;
}
