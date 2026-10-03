"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

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

// Keeps the browser chrome tint (status bar / Safari toolbars) in sync with the
// page actually on screen. Next's per-route `themeColor` meta goes stale on
// client navigation (leaving a profile kept its custom color on every page),
// and the static root value ignores dark mode. The profile page paints `html`
// with its own color, so reading html's background (falling back to body's)
// yields the profile color there and the site background everywhere else.
export function ThemeColorSync() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
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
      } else {
        metas.forEach((m) => {
          m.removeAttribute("media");
          m.content = color;
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, resolvedTheme]);

  return null;
}
