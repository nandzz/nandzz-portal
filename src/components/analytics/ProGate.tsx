"use client";

import Link from "next/link";
import { Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export function ProGate() {
  const { t } = useLanguage();
  return (
    <div className="relative rounded-xl border border-border/60 overflow-hidden">
      {/* Blurred preview */}
      <div className="pointer-events-none select-none blur-sm opacity-40 p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[480, 120, 34].map((n, i) => (
            <div key={i} className="rounded-lg border bg-card p-4">
              <p className="text-2xl font-bold">{n}</p>
              <p className="text-xs text-muted-foreground mt-1">placeholder</p>
            </div>
          ))}
        </div>
        <div className="h-48 rounded-lg bg-muted" />
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/60 backdrop-blur-sm p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/50">
          <Lock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold">{t.proGate.title}</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t.proGate.desc}
          </p>
        </div>
        <Link href="/dashboard/billing?checkout=pro">
          <Button size="sm" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            {t.proGate.upgradePro}
          </Button>
        </Link>
      </div>
    </div>
  );
}
