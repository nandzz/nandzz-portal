"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import type { StatsPeriod } from "@/lib/period";

// Drives the server-rendered analytics pages via `?period=` — the page itself
// re-fetches/re-buckets on the server, so this only needs to update the URL.
export function AnalyticsPeriodControl({ period }: { period: StatsPeriod }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (next: StatsPeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", next);
    router.push(`${pathname}?${params.toString()}`);
  };

  return <PeriodSelector value={period} onChange={handleChange} />;
}
