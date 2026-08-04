"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function BuyCreditsButton({
  packId,
  credits,
  highlighted,
}: {
  packId: string;
  credits: number;
  highlighted: boolean;
}) {
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
        setError(json.error ?? "Checkout failed");
        return;
      }
      if (json.url) {
        window.location.href = json.url;
      }
    } catch {
      setError("Network error — try again");
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
        {loading ? "Opening checkout…" : `Get ${credits.toLocaleString()} credits`}
        {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>
      {error && (
        <p className="text-xs text-destructive mt-2">{error}</p>
      )}
    </>
  );
}
