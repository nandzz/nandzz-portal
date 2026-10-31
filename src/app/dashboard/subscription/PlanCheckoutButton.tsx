"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

// Starts Stripe Checkout (mode: subscription) for a site-wide plan.
export function PlanCheckoutButton({
  planSlug,
  label,
  variant = "default",
  interval = "month",
  className,
}: {
  planSlug: string;
  label: string;
  variant?: "default" | "outline";
  interval?: "month" | "year";
  className?: string;
}) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/plan-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_slug: planSlug, interval }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        // Never surface the raw API error body; show localized copy.
        console.error("[plan] checkout failed:", data?.error);
        setError(t.billing.checkoutFailed);
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      console.error("[plan] checkout network error:", err);
      setError(t.billing.networkError);
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" className={cn("w-full", className)} variant={variant} onClick={checkout} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {label}
      </Button>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </>
  );
}
