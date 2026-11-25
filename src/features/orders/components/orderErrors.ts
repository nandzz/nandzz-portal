import type { ProductView } from "../server/load-products";
import type { OrderActionError } from "../actions/orders";
import { fill, type OrdersT } from "./shared";

// Order RPC error code → owner-facing text (7 locales via the `orders`
// dictionary). Codes the owner can't cause from the dashboard fall back to the
// generic message.
export function orderErrorText(
  t: OrdersT,
  code: OrderActionError,
  detail: Record<string, unknown> | undefined,
  products: Pick<ProductView, "id" | "name">[] = [],
): string {
  const productName = () => products.find((p) => p.id === detail?.product_id)?.name ?? t.unknownProduct;
  switch (code) {
    case "sold_out":
      return fill(t.oeSoldOut, { name: productName(), n: Number(detail?.available ?? 0) });
    case "unknown_product":
      return fill(t.oeUnknownProduct, { name: productName() });
    case "bad_quantity":
      return fill(t.oeBadQuantity, { name: productName() });
    case "duplicate_product":
      return t.oeDuplicateProduct;
    case "no_items":
      return t.needItems;
    case "too_many_lines":
      return fill(t.oeTooManyLines, { n: Number(detail?.max ?? 30) });
    case "not_set_up":
      return t.oeNotSetUp;
    case "address_required":
      return t.addressRequired;
    case "name_required":
      return t.nameRequired;
    case "bad_email":
    case "bad_phone":
    case "bad_date":
    case "invalid_value":
    case "bad_request":
    case "bad_method":
    case "note_too_long":
      return t.fixFields;
    case "bad_transition":
    case "order_closed":
      return t.oeOrderChanged;
    case "not_found":
      return t.oeNotFound;
    case "monthly_limit":
      return t.oeMonthlyLimit;
    case "NOT_ENTITLED":
    case "not_entitled":
      return t.errNotEntitled;
    case "suspended":
      return t.blockedSuspended;
    case "orders_disabled":
      return t.blockedDisabled;
    default:
      return t.errFailed;
  }
}
