export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnerWidgetById } from "@/lib/widgets/server";
import { normalizeCalendarConfig } from "@/lib/widgets/calendar";
import { renderWidgetIcon } from "@/components/widgets/widgetIcon";
import { WidgetWorkspace } from "@/components/widgets/calendar/WidgetWorkspace";
import { LocaleSelect } from "@/components/layout/LocaleSelect";
import { ChevronLeft } from "lucide-react";
import type { WidgetBooking } from "@/lib/types";
import { getServerTranslations, getCurrentLocale } from "@/lib/i18n/server";

const CURRENCY_SYMBOLS: Record<string, string> = { usd: "$", eur: "€", gbp: "£" };

export default async function WidgetStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const widget = await getOwnerWidgetById(user.id, id);
  if (!widget) notFound();

  const isCalendar = widget.catalog.slug === "calendar";
  if (!isCalendar) notFound();

  const admin = createAdminClient();
  const [{ data: bookingRows }, { data: profile }, t, locale] = await Promise.all([
    admin
      .from("widget_bookings")
      .select("*")
      .eq("instance_id", id)
      .order("starts_at", { ascending: true }),
    admin.from("profiles").select("username").eq("id", user.id).maybeSingle(),
    getServerTranslations(),
    getCurrentLocale(),
  ]);

  const bookings = (bookingRows ?? []) as WidgetBooking[];
  const config = normalizeCalendarConfig(widget.config);
  const currencySymbol =
    CURRENCY_SYMBOLS[widget.catalog.currency?.toLowerCase()] ?? widget.catalog.currency?.toUpperCase() ?? "$";

  const canShare = widget.has_access && widget.enabled && !!profile?.username;
  const shareUrl = canShare ? `/${profile!.username}/widget/${id}` : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/dashboard/widgets"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {t.booking.allWidgetsLink}
      </Link>

      <div className="mb-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
            {renderWidgetIcon(widget.catalog.icon, "h-5 w-5 text-emerald-600 dark:text-emerald-400")}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{widget.catalog.name}</h1>
            <p className="text-sm text-muted-foreground">
              {widget.has_access
                ? widget.enabled
                  ? t.booking.liveOnProfile
                  : t.booking.activeHiddenFromProfile
                : t.booking.inactiveSubscribe}
            </p>
          </div>
        </div>
        <LocaleSelect />
      </div>

      <Suspense>
        <WidgetWorkspace
          instanceId={widget.id}
          catalogId={widget.catalog_id}
          hasAccess={widget.has_access}
          enabled={widget.enabled}
          config={config}
          allBookings={bookings}
          currencySymbol={currencySymbol}
          shareUrl={shareUrl}
          locale={locale}
        />
      </Suspense>
    </div>
  );
}
