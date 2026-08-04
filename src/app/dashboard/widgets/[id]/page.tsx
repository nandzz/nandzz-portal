export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnerWidgetById } from "@/lib/widgets/server";
import { normalizeCalendarConfig } from "@/lib/widgets/calendar";
import { formatBookingTime } from "@/lib/widgets/emails";
import { CalendarWidgetStudio } from "@/components/widgets/calendar/CalendarWidgetStudio";
import { SubscribeButton } from "@/components/widgets/SubscribeButton";
import { ChevronLeft, Check, CircleAlert } from "lucide-react";
import type { WidgetBooking } from "@/lib/types";

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

  const admin = createAdminClient();
  const { data: bookingRows } = await admin
    .from("widget_bookings")
    .select("*")
    .eq("instance_id", id)
    .order("starts_at", { ascending: true });

  const bookings = (bookingRows ?? []) as WidgetBooking[];
  const now = Date.now();
  const upcoming = bookings.filter(
    (b) => b.status === "confirmed" && new Date(b.starts_at).getTime() >= now
  );
  const past = bookings.filter(
    (b) => b.status !== "confirmed" || new Date(b.starts_at).getTime() < now
  );

  const config = normalizeCalendarConfig(widget.config);
  const isCalendar = widget.catalog.slug === "calendar";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/dashboard/widgets"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> All widgets
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{widget.catalog.name}</h1>
          <p className="mt-1 text-muted-foreground">Configure your widget and manage bookings.</p>
        </div>
      </div>

      {/* Subscription status */}
      <div className="mb-8 rounded-2xl border border-border bg-background p-5">
        {widget.has_access ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <Check className="h-4 w-4" /> Subscription active
            </span>
            {/* POST → Stripe billing portal (303 redirect). */}
            <form action="/api/stripe/portal" method="post">
              <button className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
                Manage subscription
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-700 dark:text-orange-300">
              <CircleAlert className="h-4 w-4" /> No active subscription — your widget is hidden.
            </span>
            <SubscribeButton catalogId={widget.catalog_id} label="Subscribe to activate" />
          </div>
        )}
      </div>

      {/* Config editor */}
      {isCalendar && (
        <CalendarWidgetStudio
          instanceId={widget.id}
          initialConfig={config}
          initialEnabled={widget.enabled}
          hasAccess={widget.has_access}
        />
      )}

      {/* Bookings */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Upcoming bookings</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming bookings.</p>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border">
            {upcoming.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{b.customer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {b.service_name} · {formatBookingTime(b.starts_at, config.timezone)}
                  </p>
                </div>
                <a href={`mailto:${b.customer_email}`} className="text-sm text-emerald-600 hover:underline">
                  {b.customer_email}
                </a>
              </div>
            ))}
          </div>
        )}

        {past.length > 0 && (
          <>
            <h2 className="mb-3 mt-8 text-lg font-semibold text-muted-foreground">Past & cancelled</h2>
            <div className="divide-y divide-border rounded-2xl border border-border opacity-70">
              {past.slice(0, 20).map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{b.customer_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {b.service_name} · {formatBookingTime(b.starts_at, config.timezone)}
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{b.status}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
