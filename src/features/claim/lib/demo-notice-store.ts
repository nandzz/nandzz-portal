"use client";

import { useSyncExternalStore } from "react";

// Shared between DemoNoticeSheet (mounted by the [username] layout, which knows
// the page is a demo) and ProfileVisitorCta (mounted by AppChrome, which
// doesn't): the sheet registers the demo username, the pill swaps its CTA for
// a "Demo page · Claim it" chip that reopens the sheet. `videoOpen` is the
// demo's pitch video (DemoVideoSheet), when it has one.
type State = { username: string | null; open: boolean; videoOpen: boolean };

let state: State = { username: null, open: false, videoOpen: false };
const listeners = new Set<() => void>();
const SERVER_STATE: State = { username: null, open: false, videoOpen: false };

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const demoNotice = {
  register: (username: string) => set({ username, open: false, videoOpen: false }),
  unregister: () => set({ username: null, open: false, videoOpen: false }),
  open: () => set({ open: true, videoOpen: false }),
  close: () => set({ open: false }),
  openVideo: () => set({ videoOpen: true, open: false }),
  closeVideo: () => set({ videoOpen: false }),
};

export function useDemoNotice(): State {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}
