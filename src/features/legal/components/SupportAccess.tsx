"use client";

import { useEffect, useState } from "react";
import { LifeBuoy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { fill, getLegalUi } from "../i18n";
import { getSupportAccess, setSupportAccess } from "../actions/support-access";

// Lets the owner grant Nandzz support temporary (7-day) edit access to their
// profile, so an admin can set it up for them via the admin MCP. Revocable.
export function SupportAccess() {
  const { locale } = useLanguage();
  const ui = getLegalUi(locale);
  const [until, setUntil] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    getSupportAccess().then((res) => {
      if (res.ok) setUntil(res.until);
      setLoaded(true);
    });
  }, []);

  async function toggle() {
    setBusy(true);
    setError(false);
    const res = await setSupportAccess(!until);
    if (res.ok) setUntil(res.until);
    else setError(true);
    setBusy(false);
  }

  const date = until
    ? new Date(until).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="mt-8 rounded-xl border p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <LifeBuoy className="h-4 w-4 text-muted-foreground" />
            {ui.supportTitle}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{ui.supportDesc}</p>
          {date && (
            <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {fill(ui.supportActiveUntil, { date })}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-destructive">{ui.supportError}</p>}
        </div>
        <Button
          variant={until ? "outline" : "default"}
          size="sm"
          className="shrink-0"
          onClick={toggle}
          disabled={!loaded || busy}
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {until ? ui.supportRevoke : ui.supportGrant}
        </Button>
      </div>
    </div>
  );
}
