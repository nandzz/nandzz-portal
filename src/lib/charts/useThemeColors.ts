"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

// Chart.js draws on <canvas>, which has no CSS — colors passed to it must be
// concrete strings, not `var(--x)`. Our CSS variables are themselves full
// color functions (e.g. `oklch(0.5 0.01 280)`), so resolving them via
// getComputedStyle is enough; no extra wrapping needed. Re-resolves whenever
// next-themes' resolvedTheme flips (the in-app toggle changes it without a
// page reload).
function resolveColors<T extends Record<string, string>>(vars: T): T {
  if (typeof window === "undefined") return vars;
  const root = getComputedStyle(document.documentElement);
  const resolved = { ...vars };
  for (const key in vars) {
    const value = root.getPropertyValue(vars[key]).trim();
    if (value) resolved[key] = value as T[Extract<keyof T, string>];
  }
  return resolved;
}

export function useThemeColors<T extends Record<string, string>>(vars: T): T {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<T>(() => resolveColors(vars));

  useEffect(() => {
    setColors(resolveColors(vars));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme]);

  return colors;
}
