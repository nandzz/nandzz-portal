"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { WidgetOverviewData } from "./WidgetOverview";

// Same two emerald steps as the booking-volume chart: realized vs. still ahead.
export const REALIZED = "hsl(160 84% 39%)"; // emerald-600
export const UPCOMING = "hsl(152 76% 80%)"; // emerald-200
// Potential = not a real amount yet → outlined + hatched, never a solid fill.
const POTENTIAL_FILL = `repeating-linear-gradient(135deg, ${REALIZED} 0 1.5px, transparent 1.5px 6px)`;

const hours = (min: number) => {
  const h = Math.round((min / 60) * 10) / 10;
  return `${h.toLocaleString()}h`;
};

/* ------------------------------------------------------------------ */
/* Occupancy — next 7 days                                             */
/* ------------------------------------------------------------------ */

export function OccupancyCard({ capacity }: { capacity: WidgetOverviewData["capacity"] }) {
  const { t } = useLanguage();
  const ref = capacity.referenceService;

  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t.booking.occupancyTitle}</h3>
          <p className="text-xs text-muted-foreground">{t.booking.occupancyCaption}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: REALIZED }} /> {t.booking.occupancyBooked}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-muted" /> {t.booking.occupancyFree}
          </span>
        </div>
      </div>

      <ul className="space-y-1">
        {capacity.days.map((d, i) => {
          const isToday = i === 0;
          const closed = d.closed || d.openMin <= 0;
          const pct = closed ? 0 : Math.min(100, Math.round((d.bookedMin / d.openMin) * 100));

          let hint: string | null = null;
          if (closed) hint = t.booking.occupancyClosed;
          else if (d.fits <= 0) hint = t.booking.occupancyFull;
          else if (ref)
            hint = t.booking.occupancyFits
              .replace("{count}", String(d.fits))
              .replace("{service}", ref.name);

          const tooltip = closed
            ? t.booking.occupancyClosed
            : t.booking.occupancyBookedOf
                .replace("{booked}", hours(d.bookedMin))
                .replace("{open}", hours(d.openMin));

          return (
            <li
              key={d.date}
              title={tooltip}
              className={cn(
                "grid grid-cols-[4.5rem_1fr_2.75rem] items-center gap-x-3 rounded-lg px-2 py-1.5",
                isToday && "bg-emerald-500/10",
              )}
            >
              <span
                className={cn(
                  "truncate text-xs",
                  isToday ? "font-semibold text-foreground" : "text-muted-foreground",
                  closed && "opacity-60",
                )}
              >
                {isToday ? t.booking.occupancyToday : d.label}
              </span>

              <div className="min-w-0">
                <div
                  className={cn("flex h-2 overflow-hidden rounded-full bg-muted", closed && "opacity-50")}
                  role="img"
                  aria-label={`${d.label}: ${closed ? t.booking.occupancyClosed : `${pct}%`}`}
                >
                  {pct > 0 && (
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: REALIZED }} />
                  )}
                </div>
                {hint && (
                  <p
                    className={cn(
                      "mt-1 truncate text-[11px] leading-none",
                      closed ? "text-muted-foreground/60" : "text-muted-foreground",
                      !closed && d.fits <= 0 && "font-medium text-foreground",
                    )}
                  >
                    {hint}
                  </p>
                )}
              </div>

              <span
                className={cn(
                  "text-right text-xs tabular-nums",
                  closed ? "text-muted-foreground/60" : "font-medium text-foreground",
                )}
              >
                {closed ? "—" : `${pct}%`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Revenue forecast — current month                                    */
/* ------------------------------------------------------------------ */

export function ForecastCard({
  forecast,
  money,
}: {
  forecast: WidgetOverviewData["forecast"];
  money: (cents: number) => string;
}) {
  const { t } = useLanguage();
  const { earnedCents, bookedCents, potentialCents, avgTicketCents } = forecast;
  const expected = earnedCents + bookedCents;
  const total = expected + potentialCents;
  const title = t.booking.forecastTitle.replace("{month}", forecast.monthLabel);

  const segments = [
    { key: "earned", label: t.booking.forecastEarned, cents: earnedCents, style: { background: REALIZED } },
    { key: "booked", label: t.booking.forecastBooked, cents: bookedCents, style: { background: UPCOMING } },
    {
      key: "potential",
      label: t.booking.forecastPotential,
      cents: potentialCents,
      style: { backgroundImage: POTENTIAL_FILL, boxShadow: `inset 0 0 0 1px ${REALIZED}` },
    },
  ].filter((s) => s.key !== "potential" || s.cents > 0);

  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <h3 className="font-semibold first-letter:uppercase">{title}</h3>

      {total <= 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t.booking.forecastEmpty}</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">{t.booking.forecastExpected}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{money(expected)}</p>
          {potentialCents > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t.booking.forecastPotentialHint.replace("{amount}", money(potentialCents))}
            </p>
          )}

          {/* Segmented bar: 2px gaps between fills, rounded outer ends. */}
          <div className="mt-5 flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={title}>
            {segments
              .filter((s) => s.cents > 0)
              .map((s) => (
                <div
                  key={s.key}
                  title={`${s.label}: ${money(s.cents)}`}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ ...s.style, width: `${(s.cents / total) * 100}%`, minWidth: 4 }}
                />
              ))}
          </div>

          <dl className={cn("mt-4 grid gap-3", segments.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
            {segments.map((s) => (
              <div key={s.key} className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={s.style} />
                  <span className="truncate">{s.label}</span>
                </dt>
                <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums">{money(s.cents)}</dd>
              </div>
            ))}
          </dl>

          {avgTicketCents > 0 && (
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
              {t.booking.forecastAvgTicket.replace("{amount}", money(avgTicketCents))}
            </p>
          )}
        </>
      )}
    </div>
  );
}
