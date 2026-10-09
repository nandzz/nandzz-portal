"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLegalUi } from "../i18n";

// GDPR Art. 15/20: self-serve copy of the user's data as a JSON file, served by
// GET /api/account/export.
export function DataExport() {
  const { locale } = useLanguage();
  const ui = getLegalUi(locale);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function download() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const name =
        /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "nandzz-data.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 rounded-xl border p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">{ui.exportTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{ui.exportDesc}</p>
          {error && <p className="mt-2 text-sm text-destructive">{ui.exportError}</p>}
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={download} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {ui.exportButton}
        </Button>
      </div>
    </div>
  );
}
