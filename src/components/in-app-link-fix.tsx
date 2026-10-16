"use client";

import { useEffect } from "react";
import { isInAppBrowser } from "@/lib/in-app-browser";

// Inside in-app browsers, turn every target=_blank link into a same-tab
// navigation so "back" returns to our page (see lib/in-app-browser).
export function InAppLinkFix() {
  useEffect(() => {
    if (!isInAppBrowser()) return;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target !== "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      e.preventDefault();
      location.assign(url.href);
    };

    // Capture phase so we run before Next's <Link> handler.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
