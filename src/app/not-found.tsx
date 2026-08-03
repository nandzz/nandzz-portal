"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted border border-border">
        <Compass className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{t.notFound.title}</h2>
      <p className="text-muted-foreground max-w-sm mb-6">{t.notFound.desc}</p>
      <Link href="/explore">
        <Button>{t.notFound.cta}</Button>
      </Link>
    </div>
  );
}
