import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { suggestedCurrencyForLocale } from "@/features/booking/domain/messages";
import { PRODUCT_IMAGES_BUCKET } from "../storage";
import type { OwnerOrdersStatus, Product, ProductImage } from "../types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ProductImageView = Pick<ProductImage, "id" | "path" | "position" | "width" | "height"> & { url: string };
export type ProductView = Product & { images: ProductImageView[] };

export type ProductsData = {
  products: ProductView[];
  /** From order_settings, or sensible defaults before the owner set them up. */
  currency: string;
  timezone: string;
  defaultLeadTimeHours: number;
  status: OwnerOrdersStatus;
};

const PRODUCT_COLUMNS =
  "id, owner_user_id, name, description, category, price_cents, unit_label, status, stock_mode, stock_qty, daily_capacity, min_qty, max_qty, lead_time_hours, available_from, available_until, fulfilment_weekdays, sort_order, created_at, updated_at";

// RLS returns only the owner's rows; the explicit owner filter keeps the
// query plan on the owner index.
export async function loadProducts(supabase: Supabase, userId: string, locale: string): Promise<ProductsData> {
  const [products, images, settings, status] = await Promise.all([
    supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("owner_user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("product_images")
      .select("id, product_id, path, position, width, height")
      .eq("owner_user_id", userId)
      .order("position", { ascending: true }),
    supabase
      .from("order_settings")
      .select("currency, timezone, default_lead_time_hours")
      .eq("owner_user_id", userId)
      .maybeSingle(),
    supabase.rpc("owner_orders_status"),
  ]);

  const storage = supabase.storage.from(PRODUCT_IMAGES_BUCKET);
  const byProduct = new Map<string, ProductImageView[]>();
  for (const img of images.data ?? []) {
    const list = byProduct.get(img.product_id) ?? [];
    list.push({ ...img, url: storage.getPublicUrl(img.path).data.publicUrl });
    byProduct.set(img.product_id, list);
  }

  return {
    products: ((products.data ?? []) as Product[]).map((p) => ({ ...p, images: byProduct.get(p.id) ?? [] })),
    currency: settings.data?.currency ?? suggestedCurrencyForLocale(locale),
    timezone: settings.data?.timezone ?? "UTC",
    defaultLeadTimeHours: settings.data?.default_lead_time_hours ?? 24,
    status: (status.data as OwnerOrdersStatus | null) ?? { manual_blocked: "not_entitled", agent_blocked: "not_entitled", product_limit: null },
  };
}
