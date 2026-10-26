import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ph = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: ph }));

async function load() {
  vi.resetModules();
  return import("./posthog");
}

describe("posthog (lazy SDK)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // The SDK loads once the page is idle (a timer in jsdom), then imports.
  const settle = async () => {
    await vi.runAllTimersAsync();
    await vi.dynamicImportSettled();
  };

  it("does nothing without a key", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const { initPostHog, track } = await load();
    expect(initPostHog()).toBe(false);
    track("x");
    await settle();
    expect(ph.init).not.toHaveBeenCalled();
    expect(ph.capture).not.toHaveBeenCalled();
  });

  it("replays calls made while the SDK loads, in order", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    const { initPostHog, identifyUser, track } = await load();
    expect(initPostHog()).toBe(true);
    identifyUser("user-1");
    track("plan_viewed", { plan: "pro" });
    expect(ph.capture).not.toHaveBeenCalled();

    await settle();
    expect(ph.init).toHaveBeenCalledOnce();
    expect(ph.init.mock.calls[0][0]).toBe("phc_test");
    expect(ph.identify).toHaveBeenCalledWith("user-1");
    expect(ph.capture).toHaveBeenCalledWith("plan_viewed", { plan: "pro" });
    expect(ph.identify.mock.invocationCallOrder[0]).toBeLessThan(ph.capture.mock.invocationCallOrder[0]);

    // Once loaded, calls go straight through.
    identifyUser(null);
    expect(ph.reset).toHaveBeenCalledOnce();
    expect(initPostHog()).toBe(true);
    expect(ph.init).toHaveBeenCalledOnce();
  });
});
