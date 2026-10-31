"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { track } from "@/lib/posthog";

const REFRESH_INTERVAL_MS = 2000;
const REFRESH_MAX_ATTEMPTS = 8;

// Celebration shown once after a verified Stripe Checkout return. The webhook
// that flips profiles.plan_* usually lands a beat after the redirect, so while
// the server still reports Free we re-render the page a few times until it
// catches up, then the rest of the page reflects the new plan on its own.
export function WelcomePlanModal({
  planName,
  features,
  trialDays,
  trialEnd,
  activated,
}: {
  planName: string;
  features: string[];
  trialDays: number | null;
  trialEnd: string | null;
  /** Whether the server already sees the paid plan (webhook processed). */
  activated: boolean;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const ts = t.subscription;
  const [open, setOpen] = useState(true);
  const attempts = useRef(0);

  useEffect(() => {
    track("plan_subscribed", { plan: planName, trial: trialDays !== null });
  }, [planName, trialDays]);

  // Once the plan is live, drop ?session_id (the path stays /dashboard/subscribed
  // for ad-conversion rules) so a reload lands on the plain subscription page
  // instead of re-opening the modal.
  useEffect(() => {
    if (activated) window.history.replaceState(null, "", "/dashboard/subscribed");
  }, [activated]);

  // Leaving the modal moves to the canonical subscription URL.
  function close() {
    setOpen(false);
    router.replace("/dashboard/subscription");
  }

  useEffect(() => {
    if (activated || attempts.current >= REFRESH_MAX_ATTEMPTS) return;
    const id = setTimeout(() => {
      attempts.current += 1;
      router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearTimeout(id);
  });

  return (
    <Dialog open={open} onClose={close} maxWidthClass="max-w-md">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/40">
          <Sparkles className="h-7 w-7 text-violet-600 dark:text-violet-400" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          {ts.welcomeTitle.replace("{plan}", planName)}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {trialDays !== null && trialEnd
            ? ts.welcomeTrialDesc.replace("{days}", String(trialDays)).replace("{date}", trialEnd)
            : ts.welcomeDesc}
        </p>
      </div>

      {features.length > 0 && (
        <ul className="mt-5 space-y-2.5 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/50">
                <Check className="h-3 w-3 text-violet-600 dark:text-violet-400" />
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {!activated && (
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {ts.welcomeActivating}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <Link href="/dashboard/booking" className="w-full">
          <Button className="h-11 w-full rounded-xl font-semibold">{ts.welcomeCta}</Button>
        </Link>
        <Button variant="ghost" className="w-full" onClick={close}>
          {ts.welcomeClose}
        </Button>
      </div>
    </Dialog>
  );
}
