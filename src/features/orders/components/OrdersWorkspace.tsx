"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ClipboardList, Package, Settings, ShoppingBag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ORDERS_BASE_PATH, ordersTabFromSegment, ordersTabPath, type OrdersTab } from "../tabs";
import type { ProductsData } from "../server/load-products";
import type { OrdersData } from "../server/load-orders";
import type { SettingsData } from "../server/load-settings";
import { localNow } from "../domain/availability";
import { inferPhoneRegion, regionForTimeZone } from "@/features/booking/domain/phone";
import { OrdersTab as OrdersListTab } from "./OrdersTab";
import { SettingsTab } from "./SettingsTab";
import { ProductsTab } from "./ProductsTab";
import { useOrdersT } from "./shared";

export function OrdersWorkspace({
  initialTab,
  ownerId,
  now,
  products,
  orders,
  settings,
}: {
  initialTab: OrdersTab;
  /** Owner id, used as the photo upload folder (Storage policies enforce it). */
  ownerId: string;
  /** Server render time, so server and client agree on "today". */
  now: number;
  products: ProductsData;
  orders: OrdersData;
  settings: SettingsData;
}) {
  const { t, locale } = useOrdersT();
  const [tab, setTab] = useState<OrdersTab>(initialTab);
  const pathname = usePathname();

  // Browser back/forward changes the path without remounting: follow it
  // (same as the booking workspace).
  useEffect(() => {
    const rel = pathname.startsWith(ORDERS_BASE_PATH) ? pathname.slice(ORDERS_BASE_PATH.length).replace(/^\//, "") : "";
    const next = ordersTabFromSegment(rel.split("/")[0] || undefined) ?? "orders";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync tab to the URL on back/forward (external-state sync)
    setTab((prev) => (prev === next ? prev : next));
  }, [pathname]);

  // Same URL model as the booking and My Agent workspaces: pushState keeps the
  // component mounted (drafts survive tab switches), back steps through tabs.
  const handleTabChange = useCallback((value: unknown) => {
    const next = String(value) as OrdersTab;
    setTab(next);
    window.history.pushState(null, "", ordersTabPath(next));
  }, []);

  const blocked = products.status.manual_blocked;
  const locked = blocked === "not_entitled" || blocked === "suspended" || blocked === "orders_disabled";
  // One source for currency + timezone across tabs: saved settings, else the
  // same defaults the Settings form starts from (booking calendar, then locale).
  const currency = settings.settings?.currency ?? settings.defaults.currency;
  const timezone = settings.settings?.timezone ?? settings.defaults.timezone;
  const productsData = { ...products, currency, timezone };
  const today = localNow(timezone, new Date(now)).date;
  // Customers are mostly local: the business's country first, else the UI
  // language. No browser signals here, so server and client render the same.
  const defaultPhoneRegion = regionForTimeZone(timezone) ?? inferPhoneRegion(null, locale, null);
  const pending = orders.orders.filter((o) => o.status === "pending").length;

  return (
    <>
      <div className="mb-6 flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/40">
          <ShoppingBag aria-hidden className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {t.title}
            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {t.devPreview}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange} className="gap-6">
        <TabsList variant="line" className="h-9 w-full sm:w-max">
          <TabsTrigger value="orders">
            <ClipboardList className="h-4 w-4 max-sm:hidden" /> {t.tabOrders}
            {pending > 0 && (
              <span className="min-w-4 rounded-full bg-orange-600 px-1 text-[10px] font-semibold leading-4 text-white tabular-nums">{pending}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="products">
            <Package className="h-4 w-4 max-sm:hidden" /> {t.tabProducts}
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 max-sm:hidden" /> {t.tabSettings}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <OrdersListTab
            data={orders}
            products={products.products}
            settings={settings.settings}
            currency={currency}
            today={today}
            canCreate={!locked}
            defaultPhoneRegion={defaultPhoneRegion}
            onOpenSettings={() => handleTabChange("settings")}
          />
        </TabsContent>
        <TabsContent value="products">
          <ProductsTab data={productsData} ownerId={ownerId} now={now} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab data={settings} readOnly={locked} />
        </TabsContent>
      </Tabs>
    </>
  );
}
