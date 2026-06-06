"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";

export function SearchBar() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(() => searchParams.get("q") ?? "");
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = (q: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    startTransition(() => {
      router.replace(`/explore${params.size ? `?${params}` : ""}`);
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setValue(q);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate(q.trim()), 400);
  };

  const clear = () => {
    setValue("");
    if (timer.current) clearTimeout(timer.current);
    startTransition(() => {
      router.replace("/explore");
    });
  };

  return (
    <div className="relative w-full max-w-md">
      {isPending ? (
        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin pointer-events-none" />
      ) : (
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      )}
      <Input
        value={value}
        onChange={handleChange}
        placeholder={t.explore.searchPlaceholder}
        className="pl-9 pr-9 bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
      />
      {value && (
        <button
          onClick={clear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t.explore.clearSearch}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
