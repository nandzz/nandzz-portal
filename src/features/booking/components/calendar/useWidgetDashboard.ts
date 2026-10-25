"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WidgetOverviewData } from "@/features/booking/components/calendar/WidgetOverview";
import type { WidgetCustomersData } from "@/features/booking/components/calendar/WidgetCustomers";
import type { CalendarData, ListData, BookingsFilter, TodayData } from "@/features/booking/dashboardTypes";
import type { StatsPeriod } from "@/lib/period";

// Client data controller for the widget dashboard. Holds each tab's windowed
// dataset in state — seeded from the loader's first-paint payload — and refetches
// the relevant slice from /api/widgets/[id]/dashboard whenever its inputs change
// (location, month, list filter/search/page, overview period, or a realtime
// nonce; Today also refreshes itself every few minutes). Every dataset is bounded, so this scales to any booking volume. A
// per-dataset request counter drops stale responses so fast interactions can't
// leave an older fetch overwriting a newer one.

export type InitialDashboard = {
  locationId: string | null;
  today: TodayData;
  overview: WidgetOverviewData;
  calendar: CalendarData;
  list: ListData;
  customers: WidgetCustomersData;
};

async function getJson<T>(instanceId: string, view: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ view, ...params });
  const res = await fetch(`/api/widgets/${instanceId}/dashboard?${qs.toString()}`);
  if (!res.ok) throw new Error(`dashboard ${view} ${res.status}`);
  return res.json() as Promise<T>;
}

// Refetch `state` via `fetcher` whenever `key` changes, skipping the run where
// `key` still equals the seed the state was hydrated with. `seedKey` is the key
// the initial state corresponds to. Returns [data, loading].
function useKeyedFetch<T>(
  key: string,
  seedKey: string,
  seed: T,
  fetcher: () => Promise<T>
): [T, boolean] {
  const [data, setData] = useState<T>(seed);
  const [loading, setLoading] = useState(false);
  const appliedKey = useRef(seedKey);
  const reqId = useRef(0);

  useEffect(() => {
    if (key === appliedKey.current) return;
    const id = ++reqId.current;
    setLoading(true);
    fetcher()
      .then((result) => {
        if (id !== reqId.current) return; // a newer request superseded this one
        appliedKey.current = key;
        setData(result);
      })
      .catch(() => {
        /* keep the last good data; the next interaction retries */
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
    // fetcher is rebuilt from the same inputs `key` encodes, so `key` alone gates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [data, loading];
}

const loc = (id: string | null) => id ?? "~"; // stable token for the null (legacy) location

export function useWidgetDashboard(opts: {
  instanceId: string;
  initial: InitialDashboard;
  locationId: string | null;
  shareUrl: string | null;
}) {
  const { instanceId, initial, locationId, shareUrl } = opts;

  // Interaction state (owned here so it survives tab unmount/remount).
  const [period, setPeriod] = useState<StatsPeriod>("month");
  const [monthKey, setMonthKey] = useState(initial.calendar.monthKey);
  const [filter, setFilterRaw] = useState<BookingsFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPageRaw] = useState(0);
  const [nonce, setNonce] = useState(0);
  const refetchAll = useCallback(() => setNonce((n) => n + 1), []);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const h = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(h);
  }, [query]);

  // Switching location invalidates the current list page/search offset.
  const prevLoc = useRef(locationId);
  useEffect(() => {
    if (prevLoc.current !== locationId) {
      prevLoc.current = locationId;
      setPageRaw(0);
    }
  }, [locationId]);

  const setFilter = useCallback((f: BookingsFilter) => {
    setFilterRaw(f);
    setPageRaw(0);
  }, []);
  const setPage = useCallback((p: number) => setPageRaw(p), []);

  const seedLoc = loc(initial.locationId);

  // Today's free gaps and "next after today" are computed against the server's
  // now, so the Today slice re-pulls on a slow clock as well as on realtime.
  const [todayTick, setTodayTick] = useState(0);
  useEffect(() => {
    const h = setInterval(() => setTodayTick((n) => n + 1), 5 * 60_000);
    return () => clearInterval(h);
  }, []);

  const [today, todayLoading] = useKeyedFetch<TodayData>(
    `${loc(locationId)}|${nonce}|${todayTick}`,
    `${seedLoc}|0|0`,
    initial.today,
    useCallback(() => getJson<TodayData>(instanceId, "today", { loc: locationId ?? "" }), [instanceId, locationId])
  );

  const [overview, overviewLoading] = useKeyedFetch<WidgetOverviewData>(
    `${loc(locationId)}|${period}|${nonce}`,
    `${seedLoc}|month|0`,
    initial.overview,
    useCallback(async () => {
      const data = await getJson<WidgetOverviewData>(instanceId, "overview", {
        loc: locationId ?? "",
        period,
      });
      return { ...data, shareUrl }; // route returns null shareUrl; keep the stable one
    }, [instanceId, locationId, period, shareUrl])
  );

  const [customers, customersLoading] = useKeyedFetch<WidgetCustomersData>(
    `${loc(locationId)}|${nonce}`,
    `${seedLoc}|0`,
    initial.customers,
    useCallback(
      () => getJson<WidgetCustomersData>(instanceId, "customers", { loc: locationId ?? "" }),
      [instanceId, locationId]
    )
  );

  const [calendar, calendarLoading] = useKeyedFetch<CalendarData>(
    `${loc(locationId)}|${monthKey}|${nonce}`,
    `${seedLoc}|${initial.calendar.monthKey}|0`,
    initial.calendar,
    useCallback(
      () => getJson<CalendarData>(instanceId, "calendar", { loc: locationId ?? "", month: monthKey }),
      [instanceId, locationId, monthKey]
    )
  );

  const [list, listLoading] = useKeyedFetch<ListData>(
    `${loc(locationId)}|${filter}|${debouncedQuery}|${page}|${nonce}`,
    `${seedLoc}|all||0|0`,
    initial.list,
    useCallback(
      () =>
        getJson<ListData>(instanceId, "list", {
          loc: locationId ?? "",
          filter,
          q: debouncedQuery,
          limit: "12",
          offset: String(page * 12),
        }),
      [instanceId, locationId, filter, debouncedQuery, page]
    )
  );

  return {
    today,
    todayLoading,
    overview,
    overviewLoading,
    period,
    setPeriod,
    customers,
    customersLoading,
    calendar,
    calendarLoading,
    monthKey,
    setMonthKey,
    list,
    listLoading,
    filter,
    setFilter,
    query,
    setQuery,
    page,
    setPage,
    refetchAll,
  };
}
