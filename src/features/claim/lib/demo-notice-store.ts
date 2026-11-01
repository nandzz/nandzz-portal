"use client";

import { useSyncExternalStore } from "react";

// Shared between DemoNoticeSheet (mounted by the [username] layout, which knows
// the page is a demo) and ProfileVisitorCta (mounted by AppChrome, which
// doesn't): the sheet registers the demo username, the pill swaps its CTA for
// a "Demo page · Claim it" chip that reopens the sheet. `videoOpen` is the
// demo's pitch video (DemoVideoSheet), when it has one. `whyOpen` is the
// "why am I seeing this page?" disclosure (DemoWhySheet).
type State = { username: string | null; open: boolean; videoOpen: boolean; whyOpen: boolean };

const CLOSED = { open: false, videoOpen: false, whyOpen: false };
let state: State = { username: null, ...CLOSED };
const listeners = new Set<() => void>();
const SERVER_STATE: State = { username: null, ...CLOSED };

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const demoNotice = {
  register: (username: string) => set({ username, ...CLOSED }),
  unregister: () => set({ username: null, ...CLOSED }),
  open: () => set({ ...CLOSED, open: true }),
  close: () => set({ open: false }),
  openVideo: () => set({ ...CLOSED, videoOpen: true }),
  closeVideo: () => set({ videoOpen: false }),
  openWhy: () => set({ ...CLOSED, whyOpen: true }),
  closeWhy: () => set({ whyOpen: false }),
};

export function useDemoNotice(): State {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}
