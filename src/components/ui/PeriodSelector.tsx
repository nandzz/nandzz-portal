"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StatsPeriod } from "@/lib/period";
import { useLanguage } from "@/contexts/LanguageContext";

export function PeriodSelector({
  value,
  onChange,
}: {
  value: StatsPeriod;
  onChange: (period: StatsPeriod) => void;
}) {
  const { t } = useLanguage();
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as StatsPeriod)}>
      <TabsList className="h-7">
        <TabsTrigger value="week" className="px-2.5 text-xs">
          {t.common.periodWeek}
        </TabsTrigger>
        <TabsTrigger value="month" className="px-2.5 text-xs">
          {t.common.periodMonth}
        </TabsTrigger>
        <TabsTrigger value="6months" className="px-2.5 text-xs">
          {t.common.period6Months}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
