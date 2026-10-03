"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

// Opens the Stripe Customer Portal (manage/cancel plan, invoices). A fetch()
// can't follow the route's cross-origin redirect, so the route returns the
// portal URL as JSON and we navigate here. Any failure (e.g. the portal isn't
// activated on the Stripe account) surfaces inline instead of dumping the user
// on a blank/error page.
export function ManageBillingButton({
  children,
  variant = "outline",
}: {
  children: React.ReactNode;
  variant?: "outline" | "link";
}) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        // Never surface the raw API error body; show localized copy.
        console.error("[billing] portal open failed:", json?.error);
        setError(t.billing.billingFailed);
        return;
      }
      window.location.href = json.url;
    } catch (err) {
      console.error("[billing] portal network error:", err);
      setError(t.billing.networkError);
    } finally {
      setLoading(false);
    }
  };

  if (variant === "link") {
    return (
      <>
        <button
          type="button"
          onClick={open}
          disabled={loading}
          className="underline underline-offset-2 hover:text-foreground disabled:opacity-60"
        >
          {loading ? t.subscription.opening : children}
        </button>
        {error && <span className="ml-2 text-destructive">{error}</span>}
      </>
    );
  }

  return (
    <div>
      <Button type="button" variant="outline" size="sm" onClick={open} disabled={loading}>
        {loading ? t.subscription.opening : children}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
