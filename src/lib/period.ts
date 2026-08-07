// Shared bucketing for "period" trend charts (booking volume, page views).
// One generalized version of the ad-hoc weekly/daily loops that used to live
// separately in calendarStats.ts and analytics.ts.

export type StatsPeriod = "week" | "month" | "6months";

export function parseStatsPeriod(value: string | undefined, fallback: StatsPeriod = "month"): StatsPeriod {
  return value === "week" || value === "month" || value === "6months" ? value : fallback;
}

type Unit = "day" | "week" | "month";

// Granularity + how many *past* buckets to show besides the current one.
const PERIOD_CONFIG: Record<StatsPeriod, { unit: Unit; pastUnits: number }> = {
  week: { unit: "day", pastUnits: 6 }, // 7 daily buckets
  month: { unit: "week", pastUnits: 4 }, // 5 weekly buckets
  "6months": { unit: "month", pastUnits: 5 }, // 6 monthly buckets
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Monday 00:00 UTC of the week containing `ms`. Weekly buckets are coarse
// enough that UTC anchoring (vs. the owner's tz) is fine for a volume trend.
function startOfWeekUtc(ms: number): number {
  const d = new Date(ms);
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
  d.setUTCDate(d.getUTCDate() - dow);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfUnit(ms: number, unit: Unit): number {
  if (unit === "day") {
    const d = new Date(ms);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (unit === "week") return startOfWeekUtc(ms);
  const d = new Date(ms);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function addUnits(ms: number, unit: Unit, n: number): number {
  if (unit === "day") return ms + n * DAY_MS;
  if (unit === "week") return ms + n * 7 * DAY_MS;
  const d = new Date(ms);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.getTime();
}

function formatBucketLabel(ms: number, unit: Unit, locale: string): string {
  const opts: Intl.DateTimeFormatOptions =
    unit === "month"
      ? { month: "short", timeZone: "UTC" }
      : { month: "short", day: "numeric", timeZone: "UTC" };
  return new Date(ms).toLocaleDateString(locale, opts);
}

export type PeriodBucket = {
  start: number;
  end: number;
  label: string;
  isFuture: boolean;
};

// Builds the buckets for a trend chart: `pastUnits` full periods before the
// current one, the current one, and (only when `includeFuture` is set — used
// by the booking widget, which has forward-dated bookings) one more ahead.
export function buildPeriodBuckets(
  period: StatsPeriod,
  locale: string,
  opts: { includeFuture?: boolean } = {}
): PeriodBucket[] {
  const { unit, pastUnits } = PERIOD_CONFIG[period];
  const currentStart = startOfUnit(Date.now(), unit);
  const futureUnits = opts.includeFuture ? 1 : 0;

  const buckets: PeriodBucket[] = [];
  for (let i = -pastUnits; i <= futureUnits; i++) {
    const start = addUnits(currentStart, unit, i);
    const end = addUnits(start, unit, 1);
    buckets.push({
      start,
      end,
      label: formatBucketLabel(start, unit, locale),
      isFuture: start > currentStart,
    });
  }
  return buckets;
}
