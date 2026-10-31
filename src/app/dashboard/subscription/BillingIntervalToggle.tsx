"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

// Monthly/Annual cadence toggle. Mirrors the /pricing toggle but drives the
// server-rendered subscription page by flipping the `?interval=` query param,
// so plan cards re-render with annual prices + savings. Preserves any other
// query params (e.g. pagination) already on the URL.
export function BillingIntervalToggle({ interval }: { interval: "month" | "year" }) {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const annual = interval === "year";

  function setInterval(next: "month" | "year") {
    const sp = new URLSearchParams(params.toString());
    if (next === "year") sp.set("interval", "year");
    else sp.delete("interval");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="mb-4 flex w-fit items-center gap-1 rounded-full border border-border/60 bg-card p-1">
      <button
        type="button"
        onClick={() => setInterval("month")}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
          !annual ? "bg-violet-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {t.subscription.monthly}
      </button>
      <button
        type="button"
        onClick={() => setInterval("year")}
        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
          annual ? "bg-violet-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {t.subscription.annual}
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            annual ? "bg-white/20 text-white" : "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
          }`}
        >
          {t.subscription.twoMonthsFree}
        </span>
      </button>
    </div>
  );
}
