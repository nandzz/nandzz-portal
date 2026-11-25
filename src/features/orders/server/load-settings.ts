import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { suggestedCurrencyForLocale } from "@/features/booking/domain/messages";
import type { OrderSettings } from "../types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const ORDER_SETTINGS_COLUMNS =
  "owner_user_id, accepting_orders, paused_until, pause_message, currency, timezone, max_orders_per_day, pickup_enabled, pickup_address, pickup_lat, pickup_lng, pickup_hours, pickup_slot_minutes, delivery_enabled, delivery_fee_cents, free_delivery_over_cents, delivery_min_order_cents, delivery_area, delivery_hours, delivery_slot_minutes, default_lead_time_hours, max_days_ahead, pending_expiry_hours, cancel_cutoff_hours, ask_customer_email, payment_instructions, allergen_note, cancellation_policy, notify, category_order, created_at, updated_at";

export type SettingsData = {
  /** null until the owner saves the Settings tab once. */
  settings: OrderSettings | null;
  /** Starting values for a first save: the booking calendar's, else the locale's. */
  defaults: { currency: string; timezone: string };
};

export async function loadOrderSettings(supabase: Supabase, userId: string, locale: string): Promise<SettingsData> {
  const [settings, calendar] = await Promise.all([
    supabase.from("order_settings").select(ORDER_SETTINGS_COLUMNS).eq("owner_user_id", userId).maybeSingle(),
    supabase.from("widget_instances").select("config").eq("user_id", userId).limit(1).maybeSingle(),
  ]);
  const cfg = (calendar.data?.config ?? {}) as { currency?: unknown; timezone?: unknown };
  return {
    settings: (settings.data as OrderSettings | null) ?? null,
    defaults: {
      currency: typeof cfg.currency === "string" && /^[a-z]{3}$/.test(cfg.currency) ? cfg.currency : suggestedCurrencyForLocale(locale),
      timezone: typeof cfg.timezone === "string" && cfg.timezone && cfg.timezone !== "UTC" ? cfg.timezone : "Europe/Rome",
    },
  };
}
