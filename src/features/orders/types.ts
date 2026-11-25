// Row and RPC types for the Orders feature (encomendas).
// Schema: supabase/migrations/20261122120000_orders_foundation.sql
// Plan: features-doc/orders-plan.md

import type { AvailabilityWindows } from "@/lib/types";

export type ProductStatus = "draft" | "active" | "archived";
export type StockMode = "unlimited" | "stock" | "daily";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "rejected";

export type OrderSource = "agent" | "manual";
export type FulfilmentMethod = "pickup" | "delivery";
export type PaymentStatus = "unpaid" | "paid" | "refunded" | "partially_refunded";
// "online" is reserved for the Stripe integration; owners can't set it.
export type PaymentMethod = "cash" | "card_in_person" | "bank_transfer" | "online";
export type OwnerPaymentMethod = Exclude<PaymentMethod, "online">;
export type OrderActor = "owner" | "agent" | "customer" | "system";
export type OrderEventType = "created" | "status" | "edited" | "items" | "payment" | "note";
export type AskCustomerEmail = "never" | "optional" | "required";
export type SlotMinutes = 0 | 15 | 30 | 60 | 120; // 0 = any time that day

export type DeliveryAddress = {
  line1: string;
  line2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type OrderSettings = {
  owner_user_id: string;
  accepting_orders: boolean;
  paused_until: string | null; // YYYY-MM-DD
  pause_message: string | null;
  currency: string;
  timezone: string;
  max_orders_per_day: number | null;
  pickup_enabled: boolean;
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_hours: AvailabilityWindows | null; // null / {} = open every day
  pickup_slot_minutes: SlotMinutes;
  delivery_enabled: boolean;
  delivery_fee_cents: number;
  free_delivery_over_cents: number | null;
  delivery_min_order_cents: number | null;
  delivery_area: string | null;
  delivery_hours: AvailabilityWindows | null;
  delivery_slot_minutes: SlotMinutes;
  default_lead_time_hours: number;
  max_days_ahead: number;
  pending_expiry_hours: number;
  cancel_cutoff_hours: number;
  ask_customer_email: AskCustomerEmail;
  payment_instructions: string | null;
  allergen_note: string | null;
  cancellation_policy: string | null;
  notify: Record<string, boolean>;
  category_order: string[];
  created_at: string;
  updated_at: string;
};

export type OrderAdminControls = {
  owner_user_id: string;
  suspended: boolean;
  suspended_reason: string | null;
  comp_until: string | null;
  product_limit_override: number | null;
  monthly_limit_override: number | null;
  updated_at: string;
};

export type Product = {
  id: string;
  owner_user_id: string;
  name: string;
  description: string | null;
  category: string | null;
  price_cents: number;
  unit_label: string | null;
  status: ProductStatus;
  stock_mode: StockMode;
  stock_qty: number | null;
  daily_capacity: number | null;
  min_qty: number;
  max_qty: number | null;
  lead_time_hours: number | null;
  available_from: string | null; // YYYY-MM-DD
  available_until: string | null;
  fulfilment_weekdays: number[] | null; // 0 = Sunday … 6 = Saturday
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProductImage = {
  id: string;
  product_id: string;
  owner_user_id: string;
  path: string; // `${owner}/${product_id}/${uuid}.webp` in bucket product-images
  position: number;
  width: number | null;
  height: number | null;
  created_at: string;
};

export type Order = {
  id: string;
  owner_user_id: string;
  order_number: number;
  status: OrderStatus;
  source: OrderSource;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_locale: string | null;
  customer_user_id: string | null;
  agent_thread_id: string | null;
  fulfilment_method: FulfilmentMethod;
  fulfil_on: string; // YYYY-MM-DD, settings timezone
  fulfil_from: string | null; // HH:MM:SS
  fulfil_to: string | null;
  delivery_address: DeliveryAddress | null;
  currency: string;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
  amount_paid_cents: number | null;
  customer_note: string | null;
  internal_note: string | null;
  cancel_reason: string | null;
  client_request_id: string | null;
  expires_at: string | null;
  confirmed_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  owner_user_id: string;
  product_id: string | null;
  name: string;
  unit_label: string | null;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  note: string | null;
  position: number;
};

export type OrderEvent = {
  id: string;
  order_id: string;
  owner_user_id: string;
  actor: OrderActor;
  type: OrderEventType;
  from_status: OrderStatus | null;
  to_status: OrderStatus | null;
  data: Record<string, unknown>;
  created_at: string;
};

// ── RPC payloads / results ──────────────────────────────────────────────────

export type OrderLineInput = { product_id: string; quantity: number; note?: string | null };

export type CreateOrderInput = {
  items: OrderLineInput[];
  fulfilment_method: FulfilmentMethod;
  fulfil_on: string;
  fulfil_from?: string | null;
  fulfil_to?: string | null;
  delivery_address?: DeliveryAddress | null;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_locale?: string | null;
  customer_note?: string | null;
  client_request_id?: string | null; // de-duplicates double submits
};

export type OrderUpdatePatch = Partial<{
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_locale: string | null;
  fulfilment_method: FulfilmentMethod;
  fulfil_on: string;
  fulfil_from: string | null;
  fulfil_to: string | null;
  delivery_address: DeliveryAddress | null;
  customer_note: string | null;
  internal_note: string | null;
  payment_status: PaymentStatus;
  payment_method: OwnerPaymentMethod | null;
  amount_paid_cents: number | null;
}>;

// Error codes raised by the order RPCs ({ ok: false, error }). Map each to
// copy in the `orders` dictionary section, all 7 locales.
export type OrderErrorCode =
  | "bad_request"
  | "invalid_value"
  | "not_found"
  | "orders_disabled"
  | "suspended"
  | "not_entitled"
  | "not_set_up"
  | "not_accepting"
  | "paused"
  | "monthly_limit"
  | "product_limit"
  | "image_limit"
  | "bad_method"
  | "method_unavailable"
  | "bad_date"
  | "date_out_of_range"
  | "closed"
  | "day_full"
  | "too_soon"
  | "too_many_pending"
  | "email_required"
  | "name_required"
  | "bad_email"
  | "bad_phone"
  | "note_too_long"
  | "address_required"
  | "below_minimum"
  | "no_items"
  | "too_many_lines"
  | "duplicate_product"
  | "unknown_product"
  | "bad_quantity"
  | "product_unavailable_on_day"
  | "sold_out"
  | "bad_transition"
  | "order_closed"
  | "bad_payment";

export type OrderRpcError = { ok: false; error: OrderErrorCode; detail: Record<string, unknown> };
export type OrderRpcResult<T extends object = Record<string, never>> = ({ ok: true } & T) | OrderRpcError;

export type CreateOrderResult = OrderRpcResult<{ order_id: string; order_number: number; total_cents: number }>;
export type SetOrderStatusResult = OrderRpcResult<{ status: OrderStatus }>;
export type ReplaceOrderItemsResult = OrderRpcResult<{ total_cents: number }>;

export type OrdersBlockedReason =
  | "orders_disabled"
  | "suspended"
  | "not_entitled"
  | "not_set_up"
  | "not_accepting"
  | "paused";

export type OwnerOrdersStatus = {
  manual_blocked: OrdersBlockedReason | null;
  agent_blocked: OrdersBlockedReason | null;
  product_limit: number | null;
};
