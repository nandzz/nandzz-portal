"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

// Kicks off Stripe Checkout (subscription) for a widget type.
export function SubscribeButton({
  catalogId,
  label,
  className,
}: {
  catalogId: string;
  label?: string;
  className?: string;
}) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/widgets/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalog_id: catalogId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(t.booking.errorCheckoutFailed);
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError(t.booking.errorCheckoutFailed);
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <Button onClick={subscribe} disabled={loading} size="sm">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {label ?? t.booking.subscribeDefaultLabel}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
