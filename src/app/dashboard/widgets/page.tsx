export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOwnerWidgets, getWidgetCatalog } from "@/lib/widgets/server";
import { SubscribeButton } from "@/components/widgets/SubscribeButton";
import { CalendarDays, Check, Settings, CircleAlert } from "lucide-react";

export default async function WidgetsDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [widgets, catalog] = await Promise.all([getOwnerWidgets(user.id), getWidgetCatalog()]);

  const ownedCatalogIds = new Set(widgets.map((w) => w.catalog_id));
  const available = catalog.filter((c) => !ownedCatalogIds.has(c.id));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
          <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Widgets</h1>
          <p className="mt-1 text-muted-foreground">Interactive tools that live on top of your profile.</p>
        </div>
      </div>

      {/* Your widgets */}
      {widgets.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Your widgets</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {widgets.map((w) => (
              <Link
                key={w.id}
                href={`/dashboard/widgets/${w.id}`}
                className="group rounded-2xl border border-border bg-background p-5 transition hover:border-emerald-400 hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                      <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-semibold">{w.catalog.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {w.enabled ? "Shown on profile" : "Hidden"}
                      </p>
                    </div>
                  </div>
                  <Settings className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </div>
                <div className="mt-4">
                  {w.has_access ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <Check className="h-3 w-3" /> Subscription active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 dark:bg-orange-950/30 dark:text-orange-300">
                      <CircleAlert className="h-3 w-3" /> Inactive — subscribe to go live
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Add a widget */}
      {available.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Add a widget</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {available.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="font-semibold">{c.name}</p>
                </div>
                {c.description && <p className="mt-3 text-sm text-muted-foreground">{c.description}</p>}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-medium">
                    ${(c.price_cents / 100).toFixed(2)}
                    <span className="text-muted-foreground">/{c.billing_interval}</span>
                  </span>
                  <SubscribeButton catalogId={c.id} label="Add widget" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {widgets.length === 0 && available.length === 0 && (
        <p className="text-muted-foreground">No widgets are available yet. Check back soon.</p>
      )}
    </div>
  );
}
