"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ordersOwner } from "../server/owner";
import type {
  CreateOrderInput,
  OrderErrorCode,
  OrderEvent,
  OrderLineInput,
  OrderStatus,
  OrderUpdatePatch,
} from "../types";

// Order writes all go through the SECURITY DEFINER RPCs (owner = auth.uid()
// inside the DB): the status machine, stock holds and totals can't be skipped.
// These actions only gate access, bound sizes and map results.

export type OrderActionError = OrderErrorCode | "UNAUTHENTICATED" | "NOT_ENTITLED" | "FAILED";
export type OrderActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: OrderActionError; detail?: Record<string, unknown> };

const PATH = "/dashboard/orders";
const uuid = z.uuid();
const MAX_PAYLOAD = 40_000;

type RpcResult = { ok: boolean; error?: OrderErrorCode; detail?: Record<string, unknown> } & Record<string, unknown>;

function fromRpc<T extends object>(data: unknown, error: unknown, pick: (r: RpcResult) => T): OrderActionResult<T> {
  const r = data as RpcResult | null;
  if (error || !r) return { ok: false, error: "FAILED" };
  if (!r.ok) return { ok: false, error: r.error ?? "FAILED", detail: r.detail };
  revalidatePath(PATH);
  return { ok: true, ...pick(r) };
}

const tooBig = (v: unknown) => JSON.stringify(v ?? null).length > MAX_PAYLOAD;

export async function createManualOrder(
  input: CreateOrderInput,
): Promise<OrderActionResult<{ orderId: string; orderNumber: number }>> {
  if (!input || typeof input !== "object" || tooBig(input)) return { ok: false, error: "bad_request" };
  const owner = await ordersOwner();
  if (!owner.ok) return { ok: false, error: owner.error };
  const { data, error } = await owner.supabase.rpc("owner_create_order", { p_payload: input });
  return fromRpc(data, error, (r) => ({ orderId: String(r.order_id), orderNumber: Number(r.order_number) }));
}

const STATUSES: OrderStatus[] = ["confirmed", "preparing", "ready", "out_for_delivery", "completed", "cancelled", "rejected"];

export async function setOrderStatus(orderId: string, status: OrderStatus, reason?: string): Promise<OrderActionResult> {
  if (!uuid.safeParse(orderId).success || !STATUSES.includes(status) || (reason && reason.length > 300)) {
    return { ok: false, error: "bad_request" };
  }
  const owner = await ordersOwner({ manageExisting: true });
  if (!owner.ok) return { ok: false, error: owner.error };
  const { data, error } = await owner.supabase.rpc("owner_set_order_status", {
    p_order_id: orderId,
    p_status: status,
    p_reason: reason?.trim() || null,
  });
  return fromRpc(data, error, () => ({}));
}

export async function updateOrder(orderId: string, patch: OrderUpdatePatch): Promise<OrderActionResult> {
  if (!uuid.safeParse(orderId).success || !patch || typeof patch !== "object" || tooBig(patch)) {
    return { ok: false, error: "bad_request" };
  }
  const owner = await ordersOwner({ manageExisting: true });
  if (!owner.ok) return { ok: false, error: owner.error };
  const { data, error } = await owner.supabase.rpc("owner_update_order", { p_order_id: orderId, p_patch: patch });
  return fromRpc(data, error, () => ({}));
}

export async function replaceOrderItems(orderId: string, items: OrderLineInput[]): Promise<OrderActionResult<{ totalCents: number }>> {
  if (!uuid.safeParse(orderId).success || !Array.isArray(items) || tooBig(items)) return { ok: false, error: "bad_request" };
  const owner = await ordersOwner({ manageExisting: true });
  if (!owner.ok) return { ok: false, error: owner.error };
  const { data, error } = await owner.supabase.rpc("owner_replace_order_items", { p_order_id: orderId, p_items: items });
  return fromRpc(data, error, (r) => ({ totalCents: Number(r.total_cents) }));
}

/** History for the order sheet (RLS: the owner's own orders only). */
export async function loadOrderEvents(orderId: string): Promise<OrderActionResult<{ events: OrderEvent[] }>> {
  if (!uuid.safeParse(orderId).success) return { ok: false, error: "bad_request" };
  const owner = await ordersOwner({ manageExisting: true });
  if (!owner.ok) return { ok: false, error: owner.error };
  const { data, error } = await owner.supabase
    .from("order_events")
    .select("id, order_id, owner_user_id, actor, type, from_status, to_status, data, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return { ok: false, error: "FAILED" };
  return { ok: true, events: (data ?? []) as OrderEvent[] };
}
