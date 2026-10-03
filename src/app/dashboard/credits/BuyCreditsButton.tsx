"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function BuyCreditsButton({
  packId,
  credits,
  highlighted,
}: {
  packId: string;
  credits: number;
  highlighted: boolean;
}) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credit_pack_id: packId }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Never surface the raw API error body; show localized copy.
        console.error("[credits] checkout failed:", json?.error);
        setError(t.billing.checkoutFailed);
        return;
      }
      if (json.url) {
        window.location.href = json.url;
      }
    } catch (err) {
      console.error("[credits] checkout network error:", err);
      setError(t.billing.networkError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        className="w-full"
        variant={highlighted ? "default" : "outline"}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? t.subscription.openingCheckout : t.subscription.getCredits.replace("{count}", credits.toLocaleString())}
        {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>
      {error && (
        <p className="text-xs text-destructive mt-2">{error}</p>
      )}
    </>
  );
}
