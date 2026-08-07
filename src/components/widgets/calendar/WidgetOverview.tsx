"use client";

import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip as ChartTooltip,
  type ChartOptions,
} from "chart.js";
import {
  CalendarClock,
  CalendarCheck,
  Wallet,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import { type BookingRowData } from "./BookingRow";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeColors } from "@/lib/charts/useThemeColors";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import type { StatsPeriod } from "@/lib/period";

ChartJS.register(BarElement, CategoryScale, LinearScale, ChartTooltip);

export type OverviewBooking = BookingRowData;

export type WidgetOverviewData = {
  timezone: string;
  currencySymbol: string;
  totals: {
    upcoming: number;
    confirmedInPeriod: number;
    revenueCents: number;
    next7: number;
    cancelled: number;
  };
  trend: { label: string; count: number; isFuture: boolean }[];
  services: { name: string; count: number; revenueCents: number }[];
  shareUrl: string | null;
};

// Two emerald shades: realized bookings vs. still-upcoming load. Same measure,
// split by time relation — a legit 2-category encoding (legend below the chart).
const REALIZED = "hsl(160 84% 39%)"; // emerald-600
const UPCOMING = "hsl(152 76% 80%)"; // emerald-200

export function WidgetOverview({
  data,
  period,
  onPeriodChange,
}: {
  data: WidgetOverviewData;
  period: StatsPeriod;
  onPeriodChange: (period: StatsPeriod) => void;
}) {
  const { t } = useLanguage();
  const colors = useThemeColors({
    grid: "--border",
    axis: "--muted-foreground",
    tooltipBg: "--background",
    tooltipBorder: "--border",
  });
  const money = (cents: number) =>
    `${data.currencySymbol}${(cents / 100).toLocaleString(undefined, {
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;

  const maxService = Math.max(1, ...data.services.map((s) => s.count));

  const tiles = [
    {
      label: t.booking.filterUpcoming,
      value: String(data.totals.upcoming),
      hint: t.booking.tileUpcomingHint.replace("{count}", String(data.totals.next7)),
      icon: CalendarClock,
    },
    {
      label: t.booking.tileAllTime,
      value: String(data.totals.confirmedInPeriod),
      hint: data.totals.cancelled
        ? t.booking.tileAllTimeHintCancelled.replace("{count}", String(data.totals.cancelled))
        : t.booking.tileAllTimeHintConfirmed,
      icon: CalendarCheck,
    },
    {
      label: t.booking.revenue,
      value: money(data.totals.revenueCents),
      hint: t.booking.tileRevenueHint,
      icon: Wallet,
    },
    {
      label: t.booking.tileNext7,
      value: String(data.totals.next7),
      hint: t.booking.tileNext7Hint,
      icon: TrendingUp,
    },
  ];

  // The bucket labels are already localized dates (e.g. "22 giu"), so the
  // actual range covered is just the first and last of them — no separate
  // "last N days" copy to translate or keep in sync with the bucketing math.
  const rangeCaption =
    data.trend.length > 0 ? `${data.trend[0].label} – ${data.trend[data.trend.length - 1].label}` : "";

  const chartData = {
    labels: data.trend.map((w) => w.label),
    datasets: [
      {
        data: data.trend.map((w) => w.count),
        backgroundColor: data.trend.map((w) => (w.isFuture ? UPCOMING : REALIZED)),
        borderRadius: 3,
        maxBarThickness: 28,
      },
    ],
  };

  const chartOptions: ChartOptions<"bar"> = {
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
          label: (ctx) => `${ctx.parsed.y} ${t.booking.appointments}`,
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      {data.shareUrl && (
        <div className="flex justify-end">
          <a
            href={data.shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
          >
            {t.booking.previewBookingPage} <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{t.label}</span>
              <t.icon className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{t.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Trend chart */}
        <div className="rounded-2xl border border-border bg-background p-5 lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">{t.booking.bookingVolume}</h3>
              <p className="text-xs text-muted-foreground">{rangeCaption}</p>
            </div>
            <div className="flex items-center gap-3">
              <PeriodSelector value={period} onChange={onPeriodChange} />
              <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: REALIZED }} /> {t.booking.realized}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: UPCOMING }} /> {t.booking.filterUpcoming}
                </span>
              </div>
            </div>
          </div>
          <div style={{ height: 200 }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Service breakdown */}
        <div className="rounded-2xl border border-border bg-background p-5 lg:col-span-2">
          <h3 className="mb-4 font-semibold">{t.booking.topServices}</h3>
          {data.services.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.booking.noServicesYet}</p>
          ) : (
            <div className="space-y-3">
              {data.services.slice(0, 5).map((s) => (
                <div key={s.name}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{s.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {s.count}
                      {s.revenueCents > 0 && ` · ${money(s.revenueCents)}`}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${(s.count / maxService) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
