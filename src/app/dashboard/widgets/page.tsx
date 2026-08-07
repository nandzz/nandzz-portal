export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOwnerWidgets, getWidgetCatalog } from "@/lib/widgets/server";
import { SubscribeButton } from "@/components/widgets/SubscribeButton";
import { renderWidgetIcon } from "@/components/widgets/widgetIcon";
import { Blocks, Check, Settings, CircleAlert } from "lucide-react";
import { getServerTranslations } from "@/lib/i18n/server";
import { PageShell } from "@/components/layout/PageShell";

export default async function WidgetsDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [widgets, catalog, t] = await Promise.all([
    getOwnerWidgets(user.id),
    getWidgetCatalog(),
    getServerTranslations(),
  ]);

  const ownedCatalogIds = new Set(widgets.map((w) => w.catalog_id));
  const available = catalog.filter((c) => !ownedCatalogIds.has(c.id));

  return (
    <PageShell width="content">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
          <Blocks className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.booking.widgetsPageTitle}</h1>
          <p className="mt-1 text-muted-foreground">{t.booking.widgetsPageSubtitle}</p>
        </div>
      </div>

      {/* Your widgets */}
      {widgets.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t.booking.yourWidgetsSection}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {widgets.map((w) => (
              <div
                key={w.id}
                className="group relative rounded-2xl border border-border bg-background p-5 transition hover:border-emerald-400 hover:shadow-sm"
              >
                {/* Stretched link — the whole card opens the widget; the gear
                    (above, at a higher z-index) opens widget-level settings instead. */}
                <Link
                  href={`/dashboard/widgets/${w.id}`}
                  className="absolute inset-0 z-0 rounded-2xl"
                  aria-label={w.catalog.name}
                />
                <div className="relative z-[1] flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                      {renderWidgetIcon(w.catalog.icon, "h-4 w-4 text-emerald-600 dark:text-emerald-400")}
                    </div>
                    <div>
                      <p className="font-semibold">{w.catalog.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {w.enabled ? t.booking.shownOnProfile : t.booking.hiddenStatus}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/widgets/${w.id}/settings`}
                    aria-label={t.booking.widgetSettingsTitle}
                    className="relative z-10 rounded-lg p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                </div>
                <div className="relative z-[1] mt-4">
                  {w.has_access ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <Check className="h-3 w-3" /> {t.booking.subscriptionActive}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 dark:bg-orange-950/30 dark:text-orange-300">
                      <CircleAlert className="h-3 w-3" /> {t.booking.inactiveSubscribe}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add a widget */}
      {available.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t.booking.addWidgetSection}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {available.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    {renderWidgetIcon(c.icon, "h-4 w-4 text-muted-foreground")}
                  </div>
                  <p className="font-semibold">{c.name}</p>
                </div>
                {c.description && <p className="mt-3 text-sm text-muted-foreground">{c.description}</p>}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-medium">
                    ${(c.price_cents / 100).toFixed(2)}
                    <span className="text-muted-foreground">/{c.billing_interval}</span>
                  </span>
                  <SubscribeButton catalogId={c.id} label={t.booking.addWidgetButton} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {widgets.length === 0 && available.length === 0 && (
        <p className="text-muted-foreground">{t.booking.noWidgetsAvailable}</p>
      )}
    </PageShell>
  );
}
