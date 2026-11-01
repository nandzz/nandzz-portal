"use client";

import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  saving: boolean;
  status: { ok: boolean; msg: string } | null;
  onSave: () => void;
}

// The shared save affordance for every booking-manager tab: a self-contained pill
// floating bottom-right rather than a full-width empty bar. The outer row is
// click-through (pointer-events-none) so only the pill itself captures clicks,
// leaving the content behind the sticky strip interactive. Each tab persists the
// same shared config controller, so saving from any of them commits the others too.
export function SaveBar({ saving, status, onSave }: Props) {
  const { t } = useLanguage();
  return (
    <div data-save-bar className="pointer-events-none sticky bottom-4 flex justify-end">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-background/90 py-1.5 pl-4 pr-1.5 shadow-lg backdrop-blur">
        {status && (
          <span className={`text-sm ${status.ok ? "text-emerald-600" : "text-red-600"}`}>
            {status.ok && <Check className="mr-1 inline h-4 w-4" />}
            {status.msg}
          </span>
        )}
        <Button onClick={onSave} disabled={saving} className="rounded-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t.booking.saveChanges}
        </Button>
      </div>
    </div>
  );
}
