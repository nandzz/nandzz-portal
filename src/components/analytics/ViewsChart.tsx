"use client";

import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import type { ViewsSeriesPoint } from "@/lib/types";
import { useThemeColors } from "@/lib/charts/useThemeColors";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

interface ViewsChartProps {
  data: ViewsSeriesPoint[];
}

export function ViewsChart({ data }: ViewsChartProps) {
  const colors = useThemeColors({
    grid: "--border",
    axis: "--muted-foreground",
    tooltipBg: "--background",
    tooltipBorder: "--border",
  });

  const chartData = {
    labels: data.map((d) => d.label),
    datasets: [
      {
        data: data.map((d) => d.views),
        backgroundColor: "hsl(263 70% 60%)",
        borderRadius: 3,
        maxBarThickness: 24,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: colors.axis, font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        ticks: { color: colors.axis, font: { size: 11 }, precision: 0 },
        grid: { color: colors.grid },
      },
    },
    plugins: {
      tooltip: {
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
        titleColor: colors.axis,
        bodyColor: colors.axis,
        padding: 8,
        cornerRadius: 8,
        titleFont: { size: 12 },
        bodyFont: { size: 12 },
        callbacks: {
          label: (ctx) => `${ctx.parsed.y} Views`,
        },
      },
    },
  };

  return (
    <div style={{ height: 200 }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
