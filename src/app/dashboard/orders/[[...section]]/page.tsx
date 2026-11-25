export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

// Orders is dev-only (FEATURES.orders). The check reads the env var inline, not
// via FEATURES: the bundler only folds it to a literal here, which makes this
// branch (and the dynamic import behind it) dead code in prod — no Orders server
// code, client chunks or server actions ship. Keep the import inside the branch.
export default async function Page(props: { params: Promise<{ section?: string[] }> }) {
  if (process.env.ORDERS_ENABLED === "1") {
    const { OrdersPage } = await import("@/features/orders/pages/OrdersPage");
    return OrdersPage(props);
  }
  notFound();
}
