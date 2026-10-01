// Compile-time feature flags. NOTE: the AI master switch is NOT here — it is a
// runtime, admin-controlled flag resolved from `app_settings` (see
// `lib/featureFlags.ts` on the server, seeded into AuthContext for the client).
export const FEATURES = {
  monetization: true,
  widgets: true,
  brand: true,
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
