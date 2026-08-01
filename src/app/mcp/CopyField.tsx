"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyField({
  value,
  copyLabel,
  copiedLabel,
}: {
  value: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard denied — user can select the text manually.
    }
  }

  return (
    <div className="flex items-stretch gap-2">
      <code className="flex-1 min-w-0 truncate rounded-md border border-border/60 bg-muted/40 px-3 py-2 font-mono text-sm">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copyLabel}
        className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition"
      >
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}
