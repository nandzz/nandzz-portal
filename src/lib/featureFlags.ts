import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FLAGS, type FeatureFlags } from "@/lib/flags";

// Runtime, admin-controlled feature flags. Unlike the compile-time `FEATURES`
// object in `flags.ts`, these are resolved from the `app_settings` table so an
// admin can flip them without a redeploy.
//
// Today there is a single flag: `ai` — the master switch for ALL AI surfaces
// (the agent chat/studio/widget AND the AI page editor) plus the credit UI that
// only exists to meter AI usage. It defaults OFF so AI stays hidden until the
// `ai_enabled` row is explicitly turned on from the admin panel. The type +
// default live in `flags.ts` so the client can share them.

// The flags live in a single rarely-changing `app_settings` row read on many
// requests, so cache it in-process with a short TTL — same approach as the
// subscription-plans catalog cache in `lib/plan.ts`.
const FLAGS_TTL_MS = 60_000;
let flagsCache: { at: number; flags: FeatureFlags } | null = null;

// Reads the `ai_enabled` app_setting (shape: `{ enabled: boolean }`). Any
// failure — missing row, no service-role env, network error — falls back to the
// safe default (AI off) rather than throwing, so a server render never crashes
// on the flag lookup.
export async function getFeatureFlags(): Promise<FeatureFlags> {
  if (flagsCache && Date.now() - flagsCache.at < FLAGS_TTL_MS) {
    return flagsCache.flags;
  }
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "ai_enabled")
      .maybeSingle();
    const enabled = (data?.value as { enabled?: unknown } | null)?.enabled === true;
    const flags: FeatureFlags = { ai: enabled };
    flagsCache = { at: Date.now(), flags };
    return flags;
  } catch {
    return DEFAULT_FLAGS;
  }
}
