"use client";

import Link from "next/link";
import { Flag } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { getLegalUi } from "../i18n";

// "Report" entry point (DSA Art. 16) for public pages. Prefills the report
// form with the absolute URL of the page being viewed.
export function ReportLink({ path, className }: { path: string; className?: string }) {
  const { locale } = useLanguage();
  const href = `/report?url=${encodeURIComponent(`https://nandzz.com${path}`)}`;
  return (
    <Link
      href={href}
      rel="nofollow"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
        className
      )}
    >
      <Flag className="h-3 w-3" />
      {getLegalUi(locale).report}
    </Link>
  );
}
