"use client";

import posthog from "posthog-js";

// PostHog product analytics. Cookieless (`persistence: "memory"`) because
// /cookies promises essential cookies only — the trade-off is that a visitor
// gets a new anonymous id on every full page load. Autocapture is off to keep
// event volume (and cost) down: only pageviews + explicit `track()` calls.
// Requests go through the same-origin `/ingest` rewrite (next.config.ts), so
// no CSP change is needed and ad blockers drop fewer events.

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

let initialized = false;

export function initPostHog(): boolean {
  if (initialized) return true;
  if (!KEY || typeof window === "undefined") return false;
  posthog.init(KEY, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    persistence: "memory",
    autocapture: false,
    capture_pageview: "history_change",
    capture_pageleave: true,
    person_profiles: "identified_only",
    disable_surveys: true,
  });
  initialized = true;
  return true;
}

export function identifyUser(userId: string | null): void {
  if (!initialized) return;
  if (userId) posthog.identify(userId);
  else posthog.reset();
}

/** Capture a named product event. No-op when PostHog isn't configured. */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.capture(event, properties);
}
