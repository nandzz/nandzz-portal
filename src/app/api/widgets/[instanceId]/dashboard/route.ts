import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { getOwnerWidgetById } from "@/features/booking/server";
import { normalizeCalendarConfig } from "@/features/booking/domain/calendar";
import { currencySymbol } from "@/features/booking/domain/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import { parseStatsPeriod } from "@/lib/period";
import {
  fetchOverviewData,
  fetchCalendarData,
  fetchListData,
  fetchCustomersData,
  fetchCustomerBookings,
  type BookingsFilter,
} from "@/features/booking/dashboardData";

// Owner-scoped data endpoint for the widget dashboard. Every tab pulls exactly
// what it renders (a period-bounded overview, one calendar month, one list page,
// or the customers rollup) instead of the whole booking table — this is the
// interactive counterpart to the loader's first-paint fetch, sharing the same
// functions in `dashboardData`. Ownership is enforced by getOwnerWidgetById,
// which only returns an instance the calling user owns.

const FILTERS = new Set<BookingsFilter>(["all", "upcoming", "past", "cancelled"]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  const { instanceId } = await params;
  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const widget = await getOwnerWidgetById(userId, instanceId);
  if (!widget || widget.catalog.slug !== "calendar") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const view = url.searchParams.get("view");
  const locParam = url.searchParams.get("loc");
  const locationId = locParam && locParam.length > 0 ? locParam : null;

  const config = normalizeCalendarConfig(widget.config);
  const location = locationId ? config.locations.find((l) => l.id === locationId) ?? null : null;
  const timezone = location?.timezone || config.timezone;
  const symbol = currencySymbol(config.currency);

  switch (view) {
    case "overview": {
      const [locale] = await Promise.all([getCurrentLocale()]);
      const period = parseStatsPeriod(url.searchParams.get("period") ?? undefined);
      const data = await fetchOverviewData(supabase, {
        instanceId,
        locationId,
        config,
        timezone,
        currencySymbol: symbol,
        locale,
        period,
        shareUrl: null, // stable per-instance; the client keeps its own copy
      });
      return NextResponse.json(data);
    }
    case "calendar": {
      const monthKey = url.searchParams.get("month") ?? "";
      if (!/^\d{4}-\d{2}$/.test(monthKey)) {
        return NextResponse.json({ error: "month=YYYY-MM required" }, { status: 400 });
      }
      const data = await fetchCalendarData(supabase, { instanceId, locationId, monthKey, timezone });
      return NextResponse.json(data);
    }
    case "list": {
      const filterParam = (url.searchParams.get("filter") ?? "all") as BookingsFilter;
      const filter = FILTERS.has(filterParam) ? filterParam : "all";
      const query = url.searchParams.get("q") ?? "";
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 12)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      const data = await fetchListData(supabase, { instanceId, locationId, filter, query, limit, offset });
      return NextResponse.json(data);
    }
    case "customers": {
      const data = await fetchCustomersData(supabase, { instanceId, locationId, timezone, currencySymbol: symbol });
      return NextResponse.json(data);
    }
    case "customer": {
      const customerId = (url.searchParams.get("id") ?? "").trim();
      if (!customerId) return NextResponse.json({ error: "id required" }, { status: 400 });
      const bookings = await fetchCustomerBookings(supabase, { instanceId, locationId, customerId });
      return NextResponse.json({ bookings });
    }
    default:
      return NextResponse.json({ error: "unknown view" }, { status: 400 });
  }
}
