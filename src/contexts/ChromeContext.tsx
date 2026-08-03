"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// A "double press" is two taps landing within this window.
const DOUBLE_TAP_MS = 300;
// Second tap must land near the first — filters out scroll/pan gestures.
const DOUBLE_TAP_DIST = 40;

type ChromeCtx = {
  isHidden: boolean;
  enableToggle: () => void;
  disableToggle: () => void;
  toggle: () => void;
  show: () => void;
};

const Ctx = createContext<ChromeCtx | null>(null);

function noop() {}

export function useChrome(): ChromeCtx {
  const c = useContext(Ctx);
  if (!c) {
    return {
      isHidden: false,
      enableToggle: noop,
      disableToggle: noop,
      toggle: noop,
      show: noop,
    };
  }
  return c;
}

export function ChromeProvider({ children }: { children: React.ReactNode }) {
  const [enabledCount, setEnabledCount] = useState(0);
  const [isHidden, setIsHidden] = useState(false);
  const enabled = enabledCount > 0;

  const enableToggle = useCallback(() => setEnabledCount((n) => n + 1), []);
  const disableToggle = useCallback(
    () => setEnabledCount((n) => Math.max(0, n - 1)),
    []
  );

  const toggle = useCallback(() => setIsHidden((h) => !h), []);
  const show = useCallback(() => setIsHidden(false), []);

  // When the gesture is disabled (e.g. leaving the space page), make sure chrome
  // is visible again so it never gets stuck hidden on another screen.
  useEffect(() => {
    if (!enabled) setIsHidden(false);
  }, [enabled]);

  // Sync state to body dataset so server-rendered wrappers can respond via CSS.
  useEffect(() => {
    const body = document.body;
    if (enabled) body.dataset.chromeToggle = "on";
    else delete body.dataset.chromeToggle;
    return () => {
      delete body.dataset.chromeToggle;
    };
  }, [enabled]);

  useEffect(() => {
    const body = document.body;
    if (isHidden) body.dataset.chromeHidden = "true";
    else delete body.dataset.chromeHidden;
  }, [isHidden]);

  return (
    <Ctx.Provider
      value={{ isHidden, enableToggle, disableToggle, toggle, show }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function IdleChromeActivator() {
  const { enableToggle, disableToggle, toggle } = useChrome();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 767px)");
    if (!mql.matches) return;

    enableToggle();

    // Double-tap anywhere in the parent document (outside the iframe) toggles
    // the chrome. Interactive controls are ignored so their own double-taps or
    // rapid clicks don't accidentally hide the bars.
    let lastTime = 0;
    let lastX = 0;
    let lastY = 0;

    const isInteractive = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el?.closest?.(
        "a, button, input, textarea, select, [role='button'], nav, [data-chrome]"
      );
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (isInteractive(e.target)) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const now = Date.now();
      const near =
        Math.abs(t.clientX - lastX) < DOUBLE_TAP_DIST &&
        Math.abs(t.clientY - lastY) < DOUBLE_TAP_DIST;
      if (now - lastTime < DOUBLE_TAP_MS && near) {
        toggle();
        lastTime = 0;
      } else {
        lastTime = now;
        lastX = t.clientX;
        lastY = t.clientY;
      }
    };

    // The space content lives in a sandboxed iframe whose taps never reach the
    // parent, so it forwards its own double-tap as a message.
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string } | null;
      if (data && typeof data === "object" && data.type === "nandzz:toggle-chrome") {
        toggle();
      }
    };

    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("message", onMessage);
      disableToggle();
    };
  }, [enableToggle, disableToggle, toggle]);

  return null;
}
