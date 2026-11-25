import { z } from "zod";

// Mirrors the CHECK constraints on public.products
// (supabase/migrations/20261122120000_orders_foundation.sql). The DB is the
// authority; this only turns bad input into a clean INVALID_INPUT early.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => s.trim() || null)
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const productInputSchema = z
  .object({
    id: z.uuid(),
    isNew: z.boolean(),
    // true ⇒ the owner didn't touch the stock count: leave the DB value alone,
    // orders may have taken units while the editor was open.
    keep_stock: z.boolean().optional(),
    name: z.string().trim().min(1).max(120),
    description: optText(2000),
    category: optText(60),
    price_cents: z.number().int().min(0).max(100_000_000),
    unit_label: optText(30),
    status: z.enum(["draft", "active", "archived"]),
    stock_mode: z.enum(["unlimited", "stock", "daily"]),
    stock_qty: z.number().int().min(0).max(1_000_000).nullable(),
    daily_capacity: z.number().int().min(0).max(100_000).nullable(),
    min_qty: z.number().int().min(1).max(999),
    max_qty: z.number().int().min(1).max(999).nullable(),
    lead_time_hours: z.number().int().min(0).max(2160).nullable(),
    available_from: isoDate.nullable(),
    available_until: isoDate.nullable(),
    fulfilment_weekdays: z.array(z.number().int().min(0).max(6)).max(7).nullable(),
  })
  .refine((p) => p.stock_mode !== "stock" || p.stock_qty !== null, { path: ["stock_qty"] })
  .refine((p) => p.stock_mode !== "daily" || p.daily_capacity !== null, { path: ["daily_capacity"] })
  .refine((p) => p.max_qty === null || p.max_qty >= p.min_qty, { path: ["max_qty"] })
  .refine((p) => !p.available_from || !p.available_until || p.available_until >= p.available_from, {
    path: ["available_until"],
  });

export type ProductInput = z.input<typeof productInputSchema>;

export const productImageInputSchema = z.object({
  path: z.string().max(300),
  width: z.number().int().min(1).max(10000).nullable(),
  height: z.number().int().min(1).max(10000).nullable(),
});

export type ProductImageInput = z.infer<typeof productImageInputSchema>;

// ── order_settings (mirrors its CHECK constraints) ─────────────────────────
const hhmm = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$|^24:00$/);
const weekKey = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export const weeklyHoursSchema = z
  .partialRecord(weekKey, z.array(z.tuple([hhmm, hhmm]).refine(([a, b]) => a < b)).max(6))
  .nullable();
const slot = z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(60), z.literal(120)]);
const money = (max: number) => z.number().int().min(0).max(max);

export const orderSettingsSchema = z.object({
  accepting_orders: z.boolean(),
  paused_until: isoDate.nullable(),
  pause_message: optText(300),
  currency: z.string().regex(/^[a-z]{3}$/),
  timezone: z.string().min(1).max(64),
  max_orders_per_day: z.number().int().min(1).max(10000).nullable(),
  pickup_enabled: z.boolean(),
  pickup_address: optText(300),
  pickup_hours: weeklyHoursSchema,
  pickup_slot_minutes: slot,
  delivery_enabled: z.boolean(),
  delivery_fee_cents: money(10_000_000),
  free_delivery_over_cents: money(100_000_000).nullable(),
  delivery_min_order_cents: money(100_000_000).nullable(),
  delivery_area: optText(500),
  delivery_hours: weeklyHoursSchema,
  delivery_slot_minutes: slot,
  default_lead_time_hours: z.number().int().min(0).max(2160),
  max_days_ahead: z.number().int().min(1).max(365),
  pending_expiry_hours: z.number().int().min(1).max(720),
  cancel_cutoff_hours: z.number().int().min(0).max(720),
  ask_customer_email: z.enum(["never", "optional", "required"]),
  payment_instructions: optText(1000),
  allergen_note: optText(1000),
  cancellation_policy: optText(1000),
});

export type OrderSettingsInput = z.input<typeof orderSettingsSchema>;
