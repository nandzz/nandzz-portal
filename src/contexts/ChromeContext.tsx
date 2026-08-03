"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const IDLE_MS = 4000;

type ChromeCtx = {
  isHidden: boolean;
  enableIdle: () => void;
  disableIdle: () => void;
  poke: () => void;
};

const Ctx = createContext<ChromeCtx | null>(null);

function noop() {}

export function useChrome(): ChromeCtx {
  const c = useContext(Ctx);
  if (!c) {
    return { isHidden: false, enableIdle: noop, disableIdle: noop, poke: noop };
  }
  return c;
}

export function ChromeProvider({ children }: { children: React.ReactNode }) {
  const [enabledCount, setEnabledCount] = useState(0);
  // "raw" idle state — final visibility is derived as `enabled && rawIdle` so
  // we never have to reset this from an effect body (the derived value goes
  // false automatically when `enabled` flips off).
  const [rawIdle, setRawIdle] = useState(false);
  const timerRef = useRef<number | null>(null);
  const enabled = enabledCount > 0;
  const isHidden = enabled && rawIdle;

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const enableIdle = useCallback(() => setEnabledCount((n) => n + 1), []);
  const disableIdle = useCallback(() => setEnabledCount((n) => Math.max(0, n - 1)), []);

  // Exposed so callers (e.g., panels opening) can force-reveal chrome.
  const poke = useCallback(() => {
    clearTimer();
    setRawIdle(false);
    timerRef.current = window.setTimeout(() => setRawIdle(true), IDLE_MS);
  }, []);

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      return;
    }

    // Kick off the initial idle timer without touching state here — the
    // timeout callback flips rawIdle when it fires.
    timerRef.current = window.setTimeout(() => setRawIdle(true), IDLE_MS);

    const bumpIdle = () => {
      clearTimer();
      setRawIdle(false);
      timerRef.current = window.setTimeout(() => setRawIdle(true), IDLE_MS);
    };

    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string } | null;
      if (data && typeof data === "object" && data.type === "nandzz:activity") {
        bumpIdle();
      }
    };

    window.addEventListener("touchstart", bumpIdle, { passive: true });
    window.addEventListener("scroll", bumpIdle, { passive: true, capture: true });
    window.addEventListener("mousedown", bumpIdle, { passive: true });
    window.addEventListener("keydown", bumpIdle);
    window.addEventListener("wheel", bumpIdle, { passive: true });
    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("touchstart", bumpIdle);
      window.removeEventListener("scroll", bumpIdle, true);
      window.removeEventListener("mousedown", bumpIdle);
      window.removeEventListener("keydown", bumpIdle);
      window.removeEventListener("wheel", bumpIdle);
      window.removeEventListener("message", onMessage);
      clearTimer();
    };
  }, [enabled]);

  // Sync state to body dataset so server-rendered wrappers can respond via CSS.
  useEffect(() => {
    const body = document.body;
    if (enabled) body.dataset.chromeIdle = "on";
    else delete body.dataset.chromeIdle;
    return () => {
      delete body.dataset.chromeIdle;
    };
  }, [enabled]);

  useEffect(() => {
    const body = document.body;
    if (isHidden) body.dataset.chromeHidden = "true";
    else delete body.dataset.chromeHidden;
  }, [isHidden]);

  return (
    <Ctx.Provider value={{ isHidden, enableIdle, disableIdle, poke }}>
      {children}
    </Ctx.Provider>
  );
}

export function IdleChromeActivator() {
  const { enableIdle, disableIdle } = useChrome();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 767px)");
    if (!mql.matches) return;
    enableIdle();
    return () => disableIdle();
  }, [enableIdle, disableIdle]);
  return null;
}
