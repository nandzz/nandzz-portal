"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { isBareAuthRoute, isWidgetRoute } from "@/lib/layout/appShell";
import { acceptCurrentTerms } from "../actions/accept-terms";
import { fill, getLegalUi } from "../i18n";

const LINK = "font-medium text-foreground underline underline-offset-2";

// Asks a signed-in user to accept a new Terms version. Rendered by the root
// layout only when the server found no acceptance row for the current version.
// Not dismissable without accepting, but non-blocking: it floats above the
// page, and the legal pages themselves stay readable.
export function TermsUpdateBanner() {
  const { locale } = useLanguage();
  const pathname = usePathname();
  const ui = getLegalUi(locale);
  const [hidden, setHidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  // Mid-signup (acceptance is recorded when the username is claimed) and the
  // chromeless public booking page are not the place for this.
  if (hidden || isBareAuthRoute(pathname) || isWidgetRoute(pathname)) return null;

  async function accept() {
    setSaving(true);
    setError(false);
    const res = await acceptCurrentTerms().catch(() => ({ ok: false as const }));
    setSaving(false);
    if (res.ok) setHidden(true);
    else setError(true);
  }

  return (
    <div
      role="region"
      aria-label={ui.bannerTitle}
      className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-xl border bg-background p-4 shadow-xl md:bottom-6 md:left-auto md:right-6 md:mx-0"
    >
      <div className="flex items-start gap-3">
        <ScrollText className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{ui.bannerTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {fill(ui.bannerBody, {
              terms: (
                <Link href="/terms" className={LINK}>
                  {ui.termsLink}
                </Link>
              ),
              privacy: (
                <Link href="/privacy" className={LINK}>
                  {ui.privacyLink}
                </Link>
              ),
            })}
          </p>
          {error && <p className="mt-2 text-xs text-destructive">{ui.bannerError}</p>}
          <Button size="sm" className="mt-3" onClick={accept} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {ui.bannerAccept}
          </Button>
        </div>
      </div>
    </div>
  );
}
