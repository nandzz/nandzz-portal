export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CheckoutPanel } from "./CheckoutPanel";
import { CreditCard, Zap, Check, ArrowRight, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

const FREE_SPACES_LIMIT = 5;

const PRO_FEATURES = [
  "Unlimited Spaces",
  "Private spaces",
  "Pro badge on profile",
  "Priority placement in Explore",
  "HTML editor (GrapesJS)",
  "Analytics (coming soon)",
];

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; billing?: string; success?: string; canceled?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/billing");
  }

  const [{ data: profile }, { count: spacesCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, username, plan_tier")
      .eq("id", user.id)
      .single(),
    supabase
      .from("spaces")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const planTier = (profile as { plan_tier?: string } | null)?.plan_tier ?? "free";
  const isPro = planTier === "pro";
  const spaceCount = spacesCount ?? 0;
  const isCheckout = params.checkout === "pro";
  const billingCycle = params.billing === "annual" ? "annual" : "monthly";
  const showSuccess = params.success === "1";
  const showCanceled = params.canceled === "1";

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute right-0 top-0 h-[300px] w-[300px] rounded-full bg-violet-100/30 blur-3xl dark:bg-violet-950/15" />
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
            <CreditCard className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Billing & Plans</h1>
            <p className="text-muted-foreground mt-0.5">Manage your subscription</p>
          </div>
        </div>

        {/* Success / canceled banners */}
        {showSuccess && (
          <div className="mb-6 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3 flex items-center gap-3">
            <Check className="h-5 w-5 text-green-600 shrink-0" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              You&apos;re now on Pro! Welcome to the club.
            </p>
          </div>
        )}
        {showCanceled && (
          <div className="mb-6 rounded-xl bg-muted border border-border/60 px-4 py-3">
            <p className="text-sm text-muted-foreground">Checkout was canceled. Your plan has not changed.</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Current plan card */}
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isPro
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isPro && <Zap className="h-3 w-3" />}
                    {isPro ? "Pro Plan" : "Free Plan"}
                  </span>
                </div>
                <h2 className="text-lg font-semibold">
                  {isPro ? "You're on Pro" : "You're on the Free plan"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {isPro
                    ? "Unlimited Spaces and all Pro features are active."
                    : `${spaceCount} of ${FREE_SPACES_LIMIT} Spaces used. Upgrade to remove limits.`}
                </p>
              </div>
              {isPro && (
                <ManageBillingButton />
              )}
            </div>

            {/* Space usage bar — free plan only */}
            {!isPro && (
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Spaces used</span>
                  <span className={spaceCount >= FREE_SPACES_LIMIT ? "text-orange-500 font-medium" : ""}>
                    {spaceCount} / {FREE_SPACES_LIMIT}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      spaceCount >= FREE_SPACES_LIMIT
                        ? "bg-orange-400"
                        : spaceCount >= FREE_SPACES_LIMIT - 1
                        ? "bg-yellow-400"
                        : "bg-violet-500"
                    }`}
                    style={{ width: `${Math.min((spaceCount / FREE_SPACES_LIMIT) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Checkout panel — shown when ?checkout=pro */}
          {isCheckout && !isPro && (
            <CheckoutPanel billingCycle={billingCycle} />
          )}

          {/* Upgrade CTA — shown when free and not in checkout flow */}
          {!isPro && !isCheckout && (
            <div className="rounded-2xl border border-violet-200 dark:border-violet-800/60 bg-gradient-to-br from-violet-50/80 to-violet-100/40 dark:from-violet-950/40 dark:to-violet-900/20 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/50">
                  <Zap className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <h2 className="font-semibold text-violet-900 dark:text-violet-100">
                  Upgrade to Pro
                </h2>
              </div>
              <p className="text-sm text-violet-700/80 dark:text-violet-300/80 mb-4">
                Unlock unlimited Spaces, private publishing, and more.
              </p>
              <ul className="space-y-2 mb-5">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-violet-800 dark:text-violet-200">
                    <Check className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard/billing?checkout=pro&billing=monthly">
                  <Button>
                    Upgrade — $9/mo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/dashboard/billing?checkout=pro&billing=annual">
                  <Button variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300">
                    Annual — $79/yr
                    <span className="ml-1.5 text-xs text-green-600 font-semibold">Save 27%</span>
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Back to dashboard */}
          <div className="pt-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                <LayoutGrid className="h-4 w-4" />
                Back to My Spaces
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManageBillingButton() {
  return (
    <form action="/api/stripe/portal" method="POST">
      <Button type="submit" variant="outline" size="sm" className="shrink-0 gap-2 border-border/60">
        <CreditCard className="h-4 w-4" />
        Manage Billing
      </Button>
    </form>
  );
}
