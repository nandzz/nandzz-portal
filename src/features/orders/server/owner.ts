import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAccountType } from "@/lib/account/server";
import { FEATURES } from "@/lib/flags";
import type { OwnerOrdersStatus } from "../types";

// The signed-in business owner, for every Orders server action. Refused when
// the feature is off, or the DB says orders are outside the plan, suspended by
// Nandzz or switched off platform-wide (owner_orders_status covers plan, comp
// grants, suspension and the kill switch in one place). "Not set up" and
// "paused" still allow managing products, settings and existing orders.
// `manageExisting: true` skips the plan check: a business that downgraded or
// was suspended must still be able to finish, cancel and review orders it
// already took (the DB functions for existing orders don't check the plan).
export async function ordersOwner(opts: { manageExisting?: boolean } = {}) {
  if (!FEATURES.orders) return { ok: false as const, error: "UNAUTHENTICATED" as const };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || (await getAccountType(supabase, user.id)) !== "business") {
    return { ok: false as const, error: "UNAUTHENTICATED" as const };
  }
  if (opts.manageExisting) return { ok: true as const, supabase, userId: user.id };
  const { data } = await supabase.rpc("owner_orders_status");
  const blocked = (data as OwnerOrdersStatus | null)?.manual_blocked;
  if (!data || blocked === "not_entitled" || blocked === "suspended" || blocked === "orders_disabled") {
    return { ok: false as const, error: "NOT_ENTITLED" as const };
  }
  return { ok: true as const, supabase, userId: user.id };
}
