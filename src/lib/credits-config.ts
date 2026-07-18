import "server-only";
import { createClient } from "@/lib/supabase/server";

// Defaults must match the seed in supabase-schema.sql so an unconfigured
// install behaves the same as a fresh seed.
const DEFAULT_PUBLISH_COST = 10;
const DEFAULT_SIGNUP_GRANT = 100;

export type CreditsConfig = {
  publishCost: number;
  signupGrant: number;
};

// Single source of truth for the two knobs that drive user-facing pricing
// copy. Every page that shows "100 free credits" or "publishing costs 10
// credits" should read this — otherwise the admin Settings page lets the
// numbers drift away from what the UI promises.
export async function getCreditsConfig(): Promise<CreditsConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["publish_space_cost", "signup_credit_grant"]);

  const map = new Map<string, { amount?: number }>();
  for (const row of data ?? []) {
    map.set(row.key as string, (row.value ?? {}) as { amount?: number });
  }

  const publishCost = Number(map.get("publish_space_cost")?.amount ?? DEFAULT_PUBLISH_COST);
  const signupGrant = Number(map.get("signup_credit_grant")?.amount ?? DEFAULT_SIGNUP_GRANT);

  return {
    publishCost: Number.isFinite(publishCost) && publishCost >= 0 ? publishCost : DEFAULT_PUBLISH_COST,
    signupGrant: Number.isFinite(signupGrant) && signupGrant >= 0 ? signupGrant : DEFAULT_SIGNUP_GRANT,
  };
}
