"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Share2, Link2, QrCode, Check, Download } from "lucide-react";
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

interface ShareMenuProps {
  url: string;
  title: string;
  size?: "sm" | "md";
}

export function ShareMenu({ url, title, size = "sm" }: ShareMenuProps) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const { t } = useLanguage();

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

  const downloadQR = () => {
    const svg = document.getElementById("space-qr-svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr-${title.toLowerCase().replace(/\s+/g, "-")}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const iconClass = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={buttonVariants({ variant: "ghost", size: "sm" })}
          aria-label={t.share.share}
        >
          <Share2 className={iconClass} />
          {size === "md" && <span className="hidden sm:inline">{t.share.share}</span>}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
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
            <QRCode id="space-qr-svg" value={fullUrl} size={200} />
          </div>
          <p className="text-xs text-muted-foreground text-center break-all max-w-xs">
            {fullUrl}
          </p>
          <button
            onClick={downloadQR}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Download className="h-3.5 w-3.5" />
            {t.share.downloadSvg}
          </button>
        </div>
      </Dialog>
    </>
  );
}
