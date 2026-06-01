"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Shield, ExternalLink, ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

function RedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawUrl = searchParams.get("url") ?? "";

  let destination: URL | null = null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      destination = parsed;
    }
  } catch {
    // invalid URL
  }

  if (!destination) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Invalid link</h1>
          <p className="text-sm text-muted-foreground">This link is not valid or safe to open.</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Go back
        </Button>
      </div>
    );
  }

  const handleContinue = () => {
    window.open(destination!.href, "_blank", "noopener,noreferrer");
    router.back();
  };

  return (
    <div className="flex flex-col items-center gap-6 text-center max-w-sm w-full">
      <div className="flex items-center justify-center h-14 w-14 rounded-full bg-violet-100 dark:bg-violet-900/30">
        <Shield className="h-6 w-6 text-violet-600 dark:text-violet-400" />
      </div>

      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold">You&apos;re leaving Nandzz</h1>
        <p className="text-sm text-muted-foreground">
          This link will take you to an external website.
        </p>
      </div>

      <div className="w-full rounded-lg border border-border/60 bg-muted/50 px-4 py-3 text-left space-y-1">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Destination</p>
        <p className="text-sm font-semibold text-foreground truncate">{destination.hostname}</p>
        <p className="text-xs text-muted-foreground truncate">{destination.href}</p>
      </div>

      <p className="text-xs text-muted-foreground">
        Nandzz is not responsible for the content of external sites.
        Make sure you trust this destination before continuing.
      </p>

      <div className="flex items-center gap-3 w-full">
        <Button variant="outline" className="flex-1" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Go back
        </Button>
        <Button
          className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
          onClick={handleContinue}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
          Continue to site
        </Button>
      </div>
    </div>
  );
}

export default function GoPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <RedirectContent />
      </Suspense>
    </div>
  );
}
