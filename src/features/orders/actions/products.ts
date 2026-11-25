"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { productImageInputSchema, productInputSchema, type ProductImageInput, type ProductInput } from "../schemas";
import type { ProductStatus } from "../types";
import { ordersOwner } from "../server/owner";

// Products tab writes. The owner's own client writes `products` and
// `product_images` (RLS pins owner = auth.uid(); CHECK constraints and the
// limit triggers guard the values). Images are uploaded browser → Storage first
// (bucket `product-images`, owner folder only), then registered here.

export type ProductActionError =
  | "UNAUTHENTICATED"
  | "NOT_ENTITLED"
  | "INVALID_INPUT"
  | "PRODUCT_LIMIT"
  | "IMAGE_LIMIT"
  | "NOT_FOUND"
  | "FAILED";

export type ProductActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: ProductActionError };

const BUCKET = "product-images";
const PATHS = ["/dashboard/orders", "/dashboard/orders/products"];

function dbError(message: string | undefined): ProductActionError {
  if (message?.includes("orders:product_limit")) return "PRODUCT_LIMIT";
  if (message?.includes("orders:image_limit")) return "IMAGE_LIMIT";
  if (message && /violates check constraint|invalid input/i.test(message)) return "INVALID_INPUT";
  return "FAILED";
}

function refresh() {
  for (const p of PATHS) revalidatePath(p);
}

/** Create (client-generated id, so photos can be uploaded under it) or update. */
export async function saveProduct(input: ProductInput): Promise<ProductActionResult<{ id: string }>> {
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const owner = await ordersOwner();
  if (!owner.ok) return { ok: false, error: owner.error };
  const { id, isNew, keep_stock, ...p } = parsed.data;

  const row = {
    ...p,
    // keep only the numbers the chosen mode uses
    stock_qty: p.stock_mode === "stock" ? p.stock_qty : null,
    daily_capacity: p.stock_mode === "daily" ? p.daily_capacity : null,
    fulfilment_weekdays: p.fulfilment_weekdays && p.fulfilment_weekdays.length > 0 && p.fulfilment_weekdays.length < 7
      ? [...new Set(p.fulfilment_weekdays)].sort()
      : null,
  };

  if (isNew) {
    const { error } = await owner.supabase.from("products").insert({ id, ...row });
    if (error) return { ok: false, error: error.code === "23505" ? "INVALID_INPUT" : dbError(error.message) };
  } else {
    // Untouched stock: don't write the count the editor loaded (it may be stale);
    // only for products that stay in stock mode (the conditional keeps the mode check atomic).
    const { stock_qty, ...rest } = row;
    const keep = keep_stock === true && row.stock_mode === "stock";
    let query = owner.supabase.from("products").update(keep ? rest : { ...rest, stock_qty }).eq("id", id);
    if (keep) query = query.eq("stock_mode", "stock");
    const { data, error } = await query.select("id");
    if (!error && keep && !data?.length) {
      // The product wasn't in stock mode any more: write the full row.
      const retry = await owner.supabase.from("products").update(row).eq("id", id).select("id");
      if (retry.error) return { ok: false, error: dbError(retry.error.message) };
      if (!retry.data?.length) return { ok: false, error: "NOT_FOUND" };
      refresh();
      return { ok: true, id };
    }
    if (error) return { ok: false, error: dbError(error.message) };
    if (!data?.length) return { ok: false, error: "NOT_FOUND" };
  }
  refresh();
  return { ok: true, id };
}

const idSchema = z.uuid();

export async function setProductStatus(id: string, status: ProductStatus): Promise<ProductActionResult> {
  if (!idSchema.safeParse(id).success || !["draft", "active", "archived"].includes(status)) {
    return { ok: false, error: "INVALID_INPUT" };
  }
  const owner = await ordersOwner();
  if (!owner.ok) return { ok: false, error: owner.error };
  const { data, error } = await owner.supabase.from("products").update({ status }).eq("id", id).select("id");
  if (error) return { ok: false, error: dbError(error.message) };
  if (!data?.length) return { ok: false, error: "NOT_FOUND" };
  refresh();
  return { ok: true };
}

/** +/- on the card: atomic in the DB, so it never overwrites an order's hold. */
export async function adjustStock(id: string, delta: number): Promise<ProductActionResult<{ stockQty: number }>> {
  if (!idSchema.safeParse(id).success || !Number.isInteger(delta) || Math.abs(delta) > 100_000 || delta === 0) {
    return { ok: false, error: "INVALID_INPUT" };
  }
  const owner = await ordersOwner();
  if (!owner.ok) return { ok: false, error: owner.error };
  const { data, error } = await owner.supabase.rpc("owner_adjust_stock", { p_product_id: id, p_delta: delta });
  const res = data as { ok: boolean; stock_qty?: number } | null;
  if (error || !res) return { ok: false, error: "FAILED" };
  if (!res.ok || res.stock_qty === undefined) return { ok: false, error: "NOT_FOUND" };
  refresh();
  return { ok: true, stockQty: res.stock_qty };
}

/** Deletes the product and its photos. Past orders keep their own copy of the
 * name and price (order_items snapshots), so nothing historical changes. */
export async function deleteProduct(id: string): Promise<ProductActionResult> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: "INVALID_INPUT" };
  const owner = await ordersOwner();
  if (!owner.ok) return { ok: false, error: owner.error };
  const { data: images } = await owner.supabase.from("product_images").select("path").eq("product_id", id);
  const { data, error } = await owner.supabase.from("products").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: dbError(error.message) };
  if (!data?.length) return { ok: false, error: "NOT_FOUND" };
  const paths = (images ?? []).map((i) => i.path as string);
  if (paths.length) await owner.supabase.storage.from(BUCKET).remove(paths);
  refresh();
  return { ok: true };
}

/** Register photos already uploaded to `${owner}/${product}/<uuid>.<ext>`. */
export async function addProductImages(
  productId: string,
  images: ProductImageInput[],
): Promise<ProductActionResult<{ ids: string[] }>> {
  const parsed = z.array(productImageInputSchema).min(1).max(10).safeParse(images);
  if (!idSchema.safeParse(productId).success || !parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const owner = await ordersOwner();
  if (!owner.ok) return { ok: false, error: owner.error };
  const pathRe = new RegExp(`^${owner.userId}/${productId}/[0-9a-f-]{36}\\.(webp|jpg)$`);
  if (!parsed.data.every((i) => pathRe.test(i.path))) return { ok: false, error: "INVALID_INPUT" };

  const { data: last } = await owner.supabase
    .from("product_images")
    .select("position")
    .eq("product_id", productId)
    .order("position", { ascending: false })
    .limit(1);
  const first = (last?.[0]?.position ?? -1) + 1;
  // One insert = all or nothing: if the image-limit trigger (or anything else)
  // refuses, no row is written and every uploaded file is removed, so the
  // editor can simply retry the whole batch.
  const { data, error } = await owner.supabase
    .from("product_images")
    .insert(parsed.data.map((img, i) => ({ product_id: productId, path: img.path, width: img.width, height: img.height, position: first + i })))
    .select("id, path");
  if (error || !data || data.length !== parsed.data.length) {
    await owner.supabase.storage.from(BUCKET).remove(parsed.data.map((i) => i.path));
    return { ok: false, error: dbError(error?.message) };
  }
  const idByPath = new Map(data.map((r) => [r.path as string, r.id as string]));
  refresh();
  return { ok: true, ids: parsed.data.map((i) => idByPath.get(i.path) as string) };
}

export async function removeProductImage(imageId: string): Promise<ProductActionResult> {
  if (!idSchema.safeParse(imageId).success) return { ok: false, error: "INVALID_INPUT" };
  const owner = await ordersOwner();
  if (!owner.ok) return { ok: false, error: owner.error };
  const { data, error } = await owner.supabase.from("product_images").delete().eq("id", imageId).select("path");
  if (error) return { ok: false, error: "FAILED" };
  if (!data?.length) return { ok: false, error: "NOT_FOUND" };
  await owner.supabase.storage.from(BUCKET).remove([data[0].path as string]);
  refresh();
  return { ok: true };
}

/** New photo order (first = cover). Ids not belonging to the product are ignored by RLS/filters. */
export async function reorderProductImages(productId: string, imageIds: string[]): Promise<ProductActionResult> {
  const ids = z.array(z.uuid()).min(1).max(20).safeParse(imageIds);
  if (!idSchema.safeParse(productId).success || !ids.success) return { ok: false, error: "INVALID_INPUT" };
  const owner = await ordersOwner();
  if (!owner.ok) return { ok: false, error: owner.error };
  const results = await Promise.all(
    ids.data.map((imgId, position) =>
      owner.supabase.from("product_images").update({ position }).eq("id", imgId).eq("product_id", productId),
    ),
  );
  if (results.some((r) => r.error)) return { ok: false, error: "FAILED" };
  refresh();
  return { ok: true };
}
