"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyViews } from "@/lib/types";

interface ViewsChartProps {
  data: DailyViews[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ViewsChart({ data }: ViewsChartProps) {
  const labelled = data.map((d) => ({ ...d, label: formatDate(d.date) }));

  // Show every 5th label to avoid crowding
  const ticks = labelled
    .filter((_, i) => i % 5 === 0 || i === labelled.length - 1)
    .map((d) => d.label);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={labelled} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
        <XAxis
          dataKey="label"
          ticks={ticks}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))" }}
          contentStyle={{
            background: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: 12,
          }}
          labelFormatter={(label) => label}
          formatter={(value) => [Number(value), "Views"]}
        />
        <Bar dataKey="views" fill="hsl(263 70% 60%)" radius={[3, 3, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
