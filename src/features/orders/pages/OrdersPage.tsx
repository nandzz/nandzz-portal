import { notFound, redirect } from "next/navigation";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { getAccountType } from "@/lib/account/server";
import { getCurrentLocale } from "@/lib/i18n/server";
import { PageShell } from "@/components/layout/PageShell";
import { OrdersWorkspace } from "../components/OrdersWorkspace";
import { ordersTabFromSegment } from "../tabs";
import { loadProducts } from "../server/load-products";
import { loadOrders } from "../server/load-orders";
import { loadOrderSettings } from "../server/load-settings";

// Orders (encomendas). Rendered by `app/dashboard/orders/[[...section]]`, which
// imports this only when FEATURES.orders is on (dev builds), so prod never
// bundles it.
// Server components render once per request, so the clock read here is stable.
const requestTime = () => Date.now();

export async function OrdersPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  if (section && section.length > 1) notFound();
  const initialTab = ordersTabFromSegment(section?.[0]);
  if (initialTab === null) notFound();

  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);
  if (!userId) redirect("/login");
  if ((await getAccountType(supabase, userId)) !== "business") redirect("/dashboard/bookings");

  const locale = await getCurrentLocale();
  const [products, orders, settings] = await Promise.all([
    loadProducts(supabase, userId, locale),
    loadOrders(supabase, userId),
    loadOrderSettings(supabase, userId, locale),
  ]);

  return (
    <PageShell width="content">
      <OrdersWorkspace
        initialTab={initialTab}
        ownerId={userId}
        now={requestTime()}
        products={products}
        orders={orders}
        settings={settings}
      />
    </PageShell>
  );
}
