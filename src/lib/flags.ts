// The cloud DEV Supabase project. A build pointed at it (or any `next dev`) is a
// dev environment; prod builds point at the prod project.
const DEV_SUPABASE_REF = "tbzxiuciztqmbnzvtryp";

// True in every dev environment: local `next dev`, or any build wired to the dev
// Supabase project. NEXT_PUBLIC_* is inlined at build time, so this resolves the
// same on the server and the client.
export const IS_DEV_ENV =
  process.env.NODE_ENV !== "production" ||
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes(DEV_SUPABASE_REF);

// Compile-time feature flags. NOTE: the AI master switch is NOT here — it is a
// runtime, admin-controlled flag resolved from `app_settings` (see
// `lib/featureFlags.ts` on the server, seeded into AuthContext for the client).
export const FEATURES = {
  monetization: true,
  widgets: true,
  brand: true,
  // My Agent (Business Agent, WhatsApp). Dev environments only, never in prod.
  // BUSINESS_AGENT_ENABLED is set from IS_DEV_ENV in next.config.ts and inlined
  // as a literal, so prod builds dead-code-eliminate every gated import (the
  // `.includes()` in IS_DEV_ENV can't be folded by the bundler).
  businessAgent: process.env.BUSINESS_AGENT_ENABLED === "1",
};

// Runtime (admin-controlled) flags. The type + default live here so BOTH the
// client (AuthContext) and the server-only resolver (`lib/featureFlags.ts`) can
// share them — this module has no `server-only` guard. `ai` is the master
// switch for every AI surface; it defaults OFF.
export type FeatureFlags = {
  ai: boolean;
};

export const DEFAULT_FLAGS: FeatureFlags = {
  ai: false,
};
