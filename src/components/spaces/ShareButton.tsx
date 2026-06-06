"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface ShareButtonProps {
  url: string;
  title: string;
  size?: "sm" | "md";
}

export function ShareButton({ url, title, size = "sm" }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const { t } = useLanguage();

  const fullUrl = typeof window !== "undefined"
    ? new URL(url, window.location.origin).href
    : url;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ url: fullUrl, title });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const iconClass = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleShare}
      className={copied ? "text-green-500 hover:text-green-500" : ""}
      aria-label={t.share.share}
    >
      {copied ? (
        <Check className={iconClass} />
      ) : (
        <Share2 className={iconClass} />
      )}
      {size === "md" && (
        <span className="hidden sm:inline">{copied ? t.share.copied : t.share.share}</span>
      )}
    </Button>
  );
}
