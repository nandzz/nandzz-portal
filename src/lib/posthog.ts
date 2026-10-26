"use client";

import type { PostHog } from "posthog-js";

// PostHog product analytics. Cookieless (`persistence: "memory"`) because
// /cookies promises essential cookies only — the trade-off is that a visitor
// gets a new anonymous id on every full page load. Autocapture is off to keep
// event volume (and cost) down: only pageviews + explicit `track()` calls.
// Requests go through the same-origin `/ingest` rewrite (next.config.ts), so
// no CSP change is needed and ad blockers drop fewer events.
//
// The SDK (~100 KB) is imported on demand rather than bundled, and only once the
// page has loaded and gone idle, so neither it nor the session recorder it pulls
// in competes with first paint or hydration. Calls made meanwhile are queued and
// replayed.
const IDLE_TIMEOUT_MS = 4000;

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

let initialized = false;
let client: PostHog | null = null;
let failed = false;
let pending: ((ph: PostHog) => void)[] = [];

function withClient(fn: (ph: PostHog) => void): void {
  if (client) fn(client);
  else if (!failed) pending.push(fn);
}

export function initPostHog(): boolean {
  if (initialized) return true;
  if (!KEY || typeof window === "undefined") return false;
  initialized = true;
  const start = () => void import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: "/ingest",
        ui_host: "https://us.posthog.com",
        persistence: "memory",
        autocapture: false,
        capture_pageview: "history_change",
        capture_pageleave: true,
        person_profiles: "identified_only",
        disable_surveys: true,
      });
      client = posthog;
      for (const fn of pending) fn(posthog);
      pending = [];
    })
    .catch(() => {
      // Blocked or failed to load: analytics stays off for this page load.
      failed = true;
      pending = [];
    });
  const whenIdle = () => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(start, { timeout: IDLE_TIMEOUT_MS });
    } else {
      window.setTimeout(start, 1500);
    }
  };
  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
  return true;
}

export function identifyUser(userId: string | null): void {
  if (!initialized) return;
  withClient((ph) => {
    if (userId) ph.identify(userId);
    else ph.reset();
  });
}

/** Capture a named product event. No-op when PostHog isn't configured. */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  withClient((ph) => ph.capture(event, properties));
}
