"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

// Set on <html> the instant a link to ANOTHER page is clicked, cleared once the
// new route commits. The profile's color overrides (page bg + app-bar tint) are
// scoped with `html:not([data-nav-leaving])`, so the chrome drops the profile's
// colors on tap instead of holding them until the next page finishes loading.
export const NAV_LEAVING_ATTR = "data-nav-leaving";

// Fired by the profile when its color overrides mount, change or unmount.
export const CHROME_TINT_EVENT = "chrome-tint-change";

// Resolve any CSS color (incl. oklch, which Safari's theme-color may not
// accept) to a plain rgb() string via a 1×1 canvas.
function toRgb(color: string): string | null {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return a === 0 ? null : `rgb(${r}, ${g}, ${b})`;
}

// Tint the status bar / Safari toolbars with the background actually on
// screen: the profile paints `html` with its own color, every other page
// leaves html transparent so body's site background wins.
function syncThemeColor() {
  const transparent = (c: string) => c === "transparent" || c === "rgba(0, 0, 0, 0)";
  const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
  const bg = transparent(htmlBg) ? getComputedStyle(document.body).backgroundColor : htmlBg;
  const color = transparent(bg) ? null : toRgb(bg);
  if (!color) return;

  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = color;
    document.head.appendChild(meta);
    return;
  }
  metas.forEach((m) => {
    if (m.hasAttribute("media")) m.removeAttribute("media");
    if (m.content !== color) m.content = color;
  });
}

// A plain left-click on a same-origin link to a different pathname (the cases
// Next's <Link> turns into a client navigation).
function leavesPage(e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || a.hasAttribute("download") || (a.target && a.target !== "_self")) return false;
  const url = new URL(a.href, location.href);
  return url.origin === location.origin && url.pathname !== location.pathname;
}

// Keeps the browser chrome tint in sync with the page on screen. Next's
// per-route `themeColor` meta goes stale on client navigation and ignores dark
// mode, so this re-derives it on route/theme changes, whenever the profile's
// tint changes, and whenever Next rewrites the head's theme-color meta.
export function ThemeColorSync() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();

  // Route committed: drop the "leaving" flag before paint so a destination
  // profile never shows a frame without its colors.
  useLayoutEffect(() => {
    document.documentElement.removeAttribute(NAV_LEAVING_ATTR);
    syncThemeColor();
  }, [pathname, resolvedTheme]);

  useEffect(() => {
    let frame = 0;
    let safety: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncThemeColor);
    };

    const onClick = (e: MouseEvent) => {
      if (!leavesPage(e)) return;
      document.documentElement.setAttribute(NAV_LEAVING_ATTR, "");
      syncThemeColor();
      // Navigation cancelled / never committed: restore the page's own colors.
      clearTimeout(safety);
      safety = setTimeout(() => {
        document.documentElement.removeAttribute(NAV_LEAVING_ATTR);
        syncThemeColor();
      }, 8000);
    };

    // Next swaps the theme-color <meta> on navigation, sometimes after our
    // route effect ran — re-apply whenever the head's metas change.
    const observer = new MutationObserver((records) => {
      if (records.some((r) => r.target instanceof HTMLMetaElement || [...r.addedNodes].some((n) => n instanceof HTMLMetaElement))) {
        schedule();
      }
    });
    observer.observe(document.head, { childList: true, attributes: true, attributeFilter: ["content", "media"], subtree: true });

    // Capture phase: Next's <Link> calls preventDefault in its own handler.
    document.addEventListener("click", onClick, true);
    window.addEventListener(CHROME_TINT_EVENT, schedule);
    window.addEventListener("popstate", schedule);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(safety);
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(CHROME_TINT_EVENT, schedule);
      window.removeEventListener("popstate", schedule);
    };
  }, []);

  return null;
}
