"use server";

import { revalidatePath } from "next/cache";
import { orderSettingsSchema, type OrderSettingsInput } from "../schemas";
import { ordersOwner } from "../server/owner";

export type SaveOrderSettingsResult =
  | { ok: true }
  | { ok: false; error: "UNAUTHENTICATED" | "NOT_ENTITLED" | "INVALID_INPUT" | "FAILED" };

// The owner's own client upserts their single order_settings row (RLS pins
// owner = auth.uid(); CHECK constraints + the guard trigger validate values,
// including the timezone). Admin-only switches live in order_admin_controls.
export async function saveOrderSettings(input: OrderSettingsInput): Promise<SaveOrderSettingsResult> {
  const parsed = orderSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const owner = await ordersOwner();
  if (!owner.ok) return { ok: false, error: owner.error };
  const s = parsed.data;
  const emptyToNull = <T extends object>(h: T | null) => (h && Object.keys(h).length ? h : null);
  const { error } = await owner.supabase.from("order_settings").upsert(
    {
      owner_user_id: owner.userId,
      ...s,
      pickup_hours: emptyToNull(s.pickup_hours),
      delivery_hours: emptyToNull(s.delivery_hours),
    },
    { onConflict: "owner_user_id" },
  );
  if (error) {
    return { ok: false, error: /check constraint|invalid timezone|invalid input/i.test(error.message) ? "INVALID_INPUT" : "FAILED" };
  }
  revalidatePath("/dashboard/orders");
  return { ok: true };
}
