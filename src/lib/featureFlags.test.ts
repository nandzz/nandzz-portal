import { describe, it, expect, vi, beforeEach } from "vitest";

// Controls what the mocked `app_settings` read returns for the `ai_enabled` row.
let settingRow: { value: unknown } | null;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: settingRow }) }),
      }),
    }),
  }),
}));

beforeEach(() => {
  // Fresh module state each test so the in-process flag cache doesn't leak.
  vi.resetModules();
  settingRow = null;
});

describe("getFeatureFlags", () => {
  it("defaults AI off when the row is missing", async () => {
    settingRow = null;
    const { getFeatureFlags } = await import("./featureFlags");
    expect(await getFeatureFlags()).toEqual({ ai: false });
  });

  it("reads AI on when enabled is true", async () => {
    settingRow = { value: { enabled: true } };
    const { getFeatureFlags } = await import("./featureFlags");
    expect(await getFeatureFlags()).toEqual({ ai: true });
  });

  it("treats a non-true enabled value as off", async () => {
    settingRow = { value: { enabled: "yes" } };
    const { getFeatureFlags } = await import("./featureFlags");
    expect(await getFeatureFlags()).toEqual({ ai: false });
  });
});
