// URL segment ↔ Orders workspace tab. The orders list lives at the base path
// (`/dashboard/orders`) and at `/dashboard/orders/orders`. Shared by the server
// page (validating the segment) and the workspace (pushing the path).
export const ORDERS_TABS = ["orders", "products", "settings"] as const;

export type OrdersTab = (typeof ORDERS_TABS)[number];

export const ORDERS_BASE_PATH = "/dashboard/orders";

export function ordersTabFromSegment(segment: string | undefined): OrdersTab | null {
  if (!segment) return "orders";
  return (ORDERS_TABS as readonly string[]).includes(segment) ? (segment as OrdersTab) : null;
}

export function ordersTabPath(tab: OrdersTab): string {
  return tab === "orders" ? ORDERS_BASE_PATH : `${ORDERS_BASE_PATH}/${tab}`;
}
