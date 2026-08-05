"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  CalendarClock,
  CalendarCheck,
  Wallet,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import { type BookingRowData } from "./BookingRow";

export type OverviewBooking = BookingRowData;

export type WidgetOverviewData = {
  timezone: string;
  currencySymbol: string;
  totals: {
    upcoming: number;
    confirmedAllTime: number;
    revenueCents: number;
    next7: number;
    cancelled: number;
  };
  weekly: { label: string; count: number; isFuture: boolean }[];
  services: { name: string; count: number; revenueCents: number }[];
  shareUrl: string | null;
};

// Two emerald shades: realized bookings vs. still-upcoming load. Same measure,
// split by time relation — a legit 2-category encoding (legend below the chart).
const REALIZED = "hsl(160 84% 39%)"; // emerald-600
const UPCOMING = "hsl(152 76% 80%)"; // emerald-200

export function WidgetOverview({ data }: { data: WidgetOverviewData }) {
  const money = (cents: number) =>
    `${data.currencySymbol}${(cents / 100).toLocaleString(undefined, {
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;

  const maxService = Math.max(1, ...data.services.map((s) => s.count));

  const tiles = [
    {
      label: "Upcoming",
      value: String(data.totals.upcoming),
      hint: `${data.totals.next7} in the next 7 days`,
      icon: CalendarClock,
    },
    {
      label: "All-time bookings",
      value: String(data.totals.confirmedAllTime),
      hint: data.totals.cancelled ? `${data.totals.cancelled} cancelled` : "confirmed",
      icon: CalendarCheck,
    },
    {
      label: "Revenue",
      value: money(data.totals.revenueCents),
      hint: "from priced services",
      icon: Wallet,
    },
    {
      label: "Next 7 days",
      value: String(data.totals.next7),
      hint: "bookings on the calendar",
      icon: TrendingUp,
    },
  ];

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
            Preview booking page <ArrowUpRight className="h-3.5 w-3.5" />
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
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Booking volume</h3>
              <p className="text-xs text-muted-foreground">By week · past &amp; upcoming</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: REALIZED }} /> Realized
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: UPCOMING }} /> Upcoming
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.weekly} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis
                dataKey="label"
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
                formatter={(value) => [Number(value), "Bookings"]}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={28}>
                {data.weekly.map((w, i) => (
                  <Cell key={i} fill={w.isFuture ? UPCOMING : REALIZED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Service breakdown */}
        <div className="rounded-2xl border border-border bg-background p-5 lg:col-span-2">
          <h3 className="mb-4 font-semibold">Top services</h3>
          {data.services.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings by service yet.</p>
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
