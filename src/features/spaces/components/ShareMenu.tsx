"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Share2, Link2, QrCode, Check, Download, Send } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import QRCode from "react-qr-code";
import { useQrDownload } from "../hooks/useQrDownload";

interface ShareMenuProps {
  url: string;
  title: string;
  size?: "sm" | "md";
  /** Replaces the default ghost-button trigger styling. */
  triggerClassName?: string;
  /** Replaces the default trigger content (icon + label). */
  triggerContent?: ReactNode;
}

export function ShareMenu({ url, title, size = "sm", triggerClassName, triggerContent }: ShareMenuProps) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const { t } = useLanguage();
  const { qrId, downloadPng, downloadSvg } = useQrDownload(title);

  // navigator.share only exists client-side; checking after mount avoids a hydration mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCanNativeShare(typeof navigator.share === "function"); }, []);

  const fullUrl =
    typeof window !== "undefined"
      ? new URL(url, window.location.origin).href
      : url;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ url: fullUrl, title });
    } catch {
      // User cancelled
    }
  };

  const iconClass = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={triggerClassName ?? buttonVariants({ variant: "ghost", size: "sm" })}
          aria-label={t.share.share}
        >
          {triggerContent ?? (
            <>
              <Share2 className={iconClass} />
              {size === "md" && <span className="hidden sm:inline">{t.share.share}</span>}
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canNativeShare && (
            <DropdownMenuItem onClick={nativeShare}>
              <Send className="h-4 w-4" />
              {t.share.shareVia}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={copyLink}>
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {copied ? t.share.copied : t.share.copyLink}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setQrOpen(true)}>
            <QrCode className="h-4 w-4" />
            {t.share.qrCode}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={qrOpen} onClose={() => setQrOpen(false)} title={t.share.qrTitle}>
        <div className="flex flex-col items-center gap-4">
          <div className="bg-white p-4 rounded-lg">
            <QRCode id={qrId} value={fullUrl} size={200} />
          </div>
          <p className="text-xs text-muted-foreground text-center break-all max-w-xs">
            {fullUrl}
          </p>
          <div className="flex gap-2">
            <button
              onClick={downloadPng}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download className="h-3.5 w-3.5" />
              {t.share.downloadPng}
            </button>
            <button
              onClick={downloadSvg}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download className="h-3.5 w-3.5" />
              {t.share.downloadSvg}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
