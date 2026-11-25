import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { OrderView } from "../domain/orders-view";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const ORDER_COLUMNS =
  "id, owner_user_id, order_number, status, source, customer_name, customer_phone, customer_email, customer_locale, customer_user_id, agent_thread_id, fulfilment_method, fulfil_on, fulfil_from, fulfil_to, delivery_address, currency, subtotal_cents, delivery_fee_cents, total_cents, payment_status, payment_method, paid_at, amount_paid_cents, customer_note, internal_note, cancel_reason, client_request_id, expires_at, confirmed_at, ready_at, completed_at, cancelled_at, created_at, updated_at";
const ITEM_COLUMNS = "id, order_id, owner_user_id, product_id, name, unit_label, unit_price_cents, quantity, line_total_cents, note, position";

const OPEN = "(pending,confirmed,preparing,ready,out_for_delivery)";
const OPEN_LIMIT = 500;
const HISTORY_DAYS = 60;
const HISTORY_LIMIT = 300;

export type OrdersData = {
  orders: OrderView[];
  /** true when a list hit its cap (the UI says older history isn't shown). */
  truncated: boolean;
};

// Every open order (they're work to do) plus recent history. RLS returns only
// the owner's rows; the explicit owner filter keeps the plan on the indexes.
export async function loadOrders(supabase: Supabase, userId: string): Promise<OrdersData> {
  const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
  const select = `${ORDER_COLUMNS}, items:order_items(${ITEM_COLUMNS})`;
  const [open, history] = await Promise.all([
    supabase
      .from("orders")
      .select(select)
      .eq("owner_user_id", userId)
      .filter("status", "in", OPEN)
      .order("fulfil_on", { ascending: true })
      .limit(OPEN_LIMIT),
    supabase
      .from("orders")
      .select(select)
      .eq("owner_user_id", userId)
      .not("status", "in", OPEN)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);
  const rows = [...(open.data ?? []), ...(history.data ?? [])] as unknown as OrderView[];
  return {
    orders: rows,
    truncated: (open.data?.length ?? 0) >= OPEN_LIMIT || (history.data?.length ?? 0) >= HISTORY_LIMIT,
  };
}
